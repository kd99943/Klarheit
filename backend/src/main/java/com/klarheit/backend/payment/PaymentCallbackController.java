package com.klarheit.backend.payment;

import com.alipay.api.internal.util.AlipaySignature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.klarheit.backend.order.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.KeyFactory;
import java.security.NoSuchAlgorithmException;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/payments/callback")
public class PaymentCallbackController {

    private final OrderService orderService;

    @Value("${app.alipay.public-key:}")
    private String alipayPublicKey;

    @Value("${app.payment.callback-secret:}")
    private String callbackSecret;

    @Value("${app.wechat.api-key:}")
    private String wechatApiKey;

    @Value("${app.wechat.platform-public-key:}")
    private String wechatPlatformPublicKey;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    public PaymentCallbackController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping("/alipay")
    public ResponseEntity<String> handleAlipayCallback(HttpServletRequest request) {
        Map<String, String> params = new HashMap<>();
        Map<String, String[]> requestParams = request.getParameterMap();
        for (String name : requestParams.keySet()) {
            String[] values = requestParams.get(name);
            params.put(name, String.join(",", values));
        }

        log.info("Received Alipay callback for trade_no: {}", params.get("trade_no"));

        String outTradeNo = params.get("out_trade_no");
        String tradeStatus = params.get("trade_status");
        String tradeNo = params.get("trade_no");

        // --- Signature verification ---
        // Production callbacks MUST be verified with the real Alipay public key (RSA2).
        // The custom HMAC fallback was removed because it is not the official Alipay
        // signature scheme and allowed forged callbacks when the secret leaked.
        if (!isAlipayConfigured()) {
            log.error("Alipay callback rejected: ALIPAY_PUBLIC_KEY is not configured. " +
                    "Real callbacks cannot be verified without it. Set ALIPAY_PUBLIC_KEY.");
            return ResponseEntity.badRequest().body("failure");
        }
        try {
            boolean signVerified = AlipaySignature.rsaCheckV1(params, alipayPublicKey.trim(), "UTF-8", "RSA2");
            if (!signVerified) {
                log.warn("Alipay callback signature verification failed using SDK for order: {}", outTradeNo);
                return ResponseEntity.badRequest().body("failure");
            }
            log.info("Alipay signature verified successfully using SDK for order: {}", outTradeNo);
        } catch (Exception e) {
            log.error("Exception during Alipay signature verification using SDK", e);
            return ResponseEntity.badRequest().body("failure");
        }

        if ("TRADE_SUCCESS".equals(tradeStatus) && outTradeNo != null) {
            String txId = tradeNo != null ? tradeNo : "ALIPAY-TX-" + System.currentTimeMillis();
            java.math.BigDecimal paidAmount = parseAmount(params.get("total_amount"));
            orderService.completePayment(outTradeNo, txId, "ALIPAY", paidAmount);
        }

        return ResponseEntity.ok("success");
    }

    private java.math.BigDecimal parseAmount(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return new java.math.BigDecimal(raw.trim());
        } catch (NumberFormatException e) {
            log.warn("Could not parse payment amount '{}'", raw);
            return null;
        }
    }

    @PostMapping("/wechat")
    public ResponseEntity<String> handleWeChatCallback(
            @RequestHeader(value = "Wechatpay-Signature", required = false) String signature,
            @RequestHeader(value = "Wechatpay-Timestamp", required = false) String timestamp,
            @RequestHeader(value = "Wechatpay-Nonce", required = false) String nonceHeader,
            @RequestHeader(value = "Wechatpay-Serial", required = false) String serialHeader,
            @RequestBody String requestBody) {
        
        log.info("Received WeChat Pay callback notification");

        ObjectMapper mapper = new ObjectMapper();

        try {
            if (requestBody.trim().startsWith("<xml>")) {
                // Fallback XML check
                String outTradeNo = extractXmlField(requestBody, "out_trade_no");
                String transactionId = extractXmlField(requestBody, "transaction_id");
                String resultCode = extractXmlField(requestBody, "result_code");
                String sign = extractXmlField(requestBody, "sign");

                String verifyKey = (wechatApiKey != null && !wechatApiKey.isBlank()) ? wechatApiKey : callbackSecret;
                if (verifyKey == null || verifyKey.isBlank()) {
                    log.warn("WeChat XML callback rejected: no verification key configured");
                    return ResponseEntity.ok("<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Invalid signature]]></return_msg></xml>");
                }
                if (!verifyHmacSignatureXml(requestBody, sign, verifyKey)) {
                    log.warn("WeChat XML callback rejected: signature verification failed for out_trade_no: {}", outTradeNo);
                    return ResponseEntity.ok("<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Invalid signature]]></return_msg></xml>");
                }

                if ("SUCCESS".equals(resultCode) && outTradeNo != null) {
                    String txId = transactionId != null ? transactionId : "WECHAT-TX-" + System.currentTimeMillis();
                    orderService.completePayment(outTradeNo, txId, "WECHAT");
                }
                return ResponseEntity.ok("<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>");
            } else {
                // WeChat Pay API v3 Webhook (JSON)
                // Step 1: Verify V3 signature. Production callbacks MUST be verified.
                // Previously this was silently skipped when the key was missing, allowing
                // forged callbacks. Now the callback is rejected instead.
                if (!isWechatV3SignatureConfigured()) {
                    log.error("WeChat v3 callback rejected: WECHAT_PLATFORM_PUBLIC_KEY is not configured. " +
                            "Callbacks cannot be verified without it.");
                    return ResponseEntity.badRequest().body("{\"code\":\"FAIL\",\"message\":\"Signature key not configured\"}");
                }
                if (signature == null || timestamp == null || nonceHeader == null) {
                    log.warn("WeChat v3 callback rejected: missing required signature headers.");
                    return ResponseEntity.badRequest().body("{\"code\":\"FAIL\",\"message\":\"Missing signature headers\"}");
                }
                if (!verifyWechatV3Signature(timestamp, nonceHeader, requestBody, signature)) {
                    log.warn("WeChat v3 callback rejected: SHA256withRSA signature verification failed.");
                    return ResponseEntity.badRequest().body("{\"code\":\"FAIL\",\"message\":\"Invalid signature\"}");
                }
                log.info("WeChat Pay v3 signature verified successfully.");

                // Step 2: Parse and decrypt
                JsonNode root = mapper.readTree(requestBody);
                JsonNode resource = root.get("resource");
                if (resource == null) {
                    return ResponseEntity.badRequest().body("{\"code\":\"FAIL\",\"message\":\"Missing resource\"}");
                }

                String ciphertext = resource.get("ciphertext").asText();
                String nonce = resource.get("nonce").asText();
                String associatedData = resource.get("associated_data") != null ? resource.get("associated_data").asText() : "";

                if (wechatApiKey == null || wechatApiKey.isBlank()) {
                    log.warn("WeChat v3 callback rejected: WECHAT_API_KEY is not configured.");
                    return ResponseEntity.badRequest().body("{\"code\":\"FAIL\",\"message\":\"Key not configured\"}");
                }

                String decryptedJson = decryptWechatV3Ciphertext(ciphertext, associatedData, nonce, wechatApiKey);
                if (decryptedJson == null) {
                    log.warn("WeChat v3 callback rejected: AES decryption failed.");
                    return ResponseEntity.badRequest().body("{\"code\":\"FAIL\",\"message\":\"Decryption failed\"}");
                }

                JsonNode decryptedNode = mapper.readTree(decryptedJson);
                String outTradeNo = decryptedNode.get("out_trade_no").asText();
                String transactionId = decryptedNode.get("transaction_id").asText();
                String tradeState = decryptedNode.get("trade_state").asText();

                if ("SUCCESS".equals(tradeState)) {
                    java.math.BigDecimal wechatPaidAmount = null;
                    JsonNode amountNode = decryptedNode.get("amount");
                    if (amountNode != null && amountNode.has("total")) {
                        // WeChat reports amount in fen (cents); convert to yuan.
                        wechatPaidAmount = java.math.BigDecimal.valueOf(amountNode.get("total").asLong(), 2);
                    }
                    orderService.completePayment(outTradeNo, transactionId, "WECHAT", wechatPaidAmount);
                }

                return ResponseEntity.ok("{\"code\":\"SUCCESS\",\"message\":\"OK\"}");
            }
        } catch (Exception e) {
            log.error("Exception handling WeChat Pay callback", e);
            if (requestBody.trim().startsWith("<xml>")) {
                return ResponseEntity.ok("<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Error]]></return_msg></xml>");
            } else {
                return ResponseEntity.badRequest().body("{\"code\":\"FAIL\",\"message\":\"Error\"}");
            }
        }
    }

    private boolean isAlipayConfigured() {
        return alipayPublicKey != null && !alipayPublicKey.isBlank();
    }

    private boolean isWechatV3SignatureConfigured() {
        return wechatPlatformPublicKey != null && !wechatPlatformPublicKey.isBlank();
    }

    /**
     * Verifies WeChat Pay API v3 webhook signature using SHA256withRSA.
     * Constructs the message as: timestamp + "\n" + nonce + "\n" + body + "\n"
     * then verifies against the platform certificate public key.
     */
    private boolean verifyWechatV3Signature(String timestamp, String nonce, String body, String signatureBase64) {
        try {
            String message = timestamp + "\n" + nonce + "\n" + body + "\n";
            // Decode the PEM public key (strip headers if present)
            String keyContent = wechatPlatformPublicKey.trim()
                    .replace("-----BEGIN PUBLIC KEY-----", "")
                    .replace("-----END PUBLIC KEY-----", "")
                    .replaceAll("\\s+", "");
            byte[] keyBytes = Base64.getDecoder().decode(keyContent);
            X509EncodedKeySpec keySpec = new X509EncodedKeySpec(keyBytes);
            PublicKey publicKey = KeyFactory.getInstance("RSA").generatePublic(keySpec);

            Signature sig = Signature.getInstance("SHA256withRSA");
            sig.initVerify(publicKey);
            sig.update(message.getBytes(StandardCharsets.UTF_8));
            return sig.verify(Base64.getDecoder().decode(signatureBase64));
        } catch (Exception e) {
            log.error("WeChat v3 signature verification error", e);
            return false;
        }
    }

    private String decryptWechatV3Ciphertext(String ciphertext, String associatedData, String nonce, String apiV3Key) {
        try {
            byte[] cipherBytes = java.util.Base64.getDecoder().decode(ciphertext);
            javax.crypto.Cipher cipher = javax.crypto.Cipher.getInstance("AES/GCM/NoPadding");
            javax.crypto.spec.SecretKeySpec keySpec = new javax.crypto.spec.SecretKeySpec(apiV3Key.getBytes(StandardCharsets.UTF_8), "AES");
            javax.crypto.spec.GCMParameterSpec gcmSpec = new javax.crypto.spec.GCMParameterSpec(128, nonce.getBytes(StandardCharsets.UTF_8));
            cipher.init(javax.crypto.Cipher.DECRYPT_MODE, keySpec, gcmSpec);
            if (associatedData != null && !associatedData.isBlank()) {
                cipher.updateAAD(associatedData.getBytes(StandardCharsets.UTF_8));
            }
            byte[] decrypted = cipher.doFinal(cipherBytes);
            return new String(decrypted, StandardCharsets.UTF_8);
        } catch (Exception e) {
            log.error("Failed to decrypt WeChat v3 ciphertext", e);
            return null;
        }
    }

    private String extractXmlField(String xml, String fieldName) {
        String openTag = "<" + fieldName + "><![CDATA[";
        String closeTag = "]]></" + fieldName + ">";
        int start = xml.indexOf(openTag);
        if (start < 0) return null;
        start += openTag.length();
        int end = xml.indexOf(closeTag, start);
        if (end < 0) return null;
        return xml.substring(start, end);
    }

    /**
     * Verifies HMAC-SHA256 signature for Alipay-style callback params.
     * Builds a sorted key=value string from all params (excluding "sign" and "sign_type"),
     * then compares the HMAC-SHA256 digest against the provided signature.
     */
    private boolean verifyHmacSignature(Map<String, String> params, String sign, String secret) {
        if (sign == null || sign.isBlank()) return false;

        TreeMap<String, String> sorted = new TreeMap<>();
        params.forEach((k, v) -> {
            if (!"sign".equals(k) && !"sign_type".equals(k) && v != null && !v.isBlank()) {
                sorted.put(k, v);
            }
        });
        String payload = String.join("&", sorted.entrySet().stream()
                .map(e -> e.getKey() + "=" + e.getValue())
                .toList());
        String computed = hmacSha256(payload, secret);
        return java.security.MessageDigest.isEqual(
                sign.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                computed.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    /**
     * Verifies HMAC-SHA256 signature for WeChat-style XML callbacks.
     * Extracts all XML fields (excluding "sign"), sorts them, concatenates as key=value&...,
     * then compares HMAC-SHA256 digest against the provided sign.
     */
    private boolean verifyHmacSignatureXml(String xmlData, String sign, String secret) {
        if (sign == null || sign.isBlank()) return false;

        // Extract all simple XML fields from the notification
        TreeMap<String, String> fields = new TreeMap<>();
        String[] knownFields = {"out_trade_no", "transaction_id", "result_code", "return_code",
                "appid", "mch_id", "nonce_str", "total_amount"};
        for (String field : knownFields) {
            String value = extractXmlField(xmlData, field);
            if (value != null && !value.isBlank()) {
                fields.put(field, value);
            }
        }
        String payload = String.join("&", fields.entrySet().stream()
                .map(e -> e.getKey() + "=" + e.getValue())
                .toList());
        String computed = hmacSha256(payload, secret);
        return java.security.MessageDigest.isEqual(
                sign.getBytes(java.nio.charset.StandardCharsets.UTF_8),
                computed.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private String hmacSha256(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) {
                hex.append(String.format("%02x", b));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException("HMAC-SHA256 not available", e);
        }
    }

    @PostMapping("/mock-trigger")
    @Profile({"local", "test"})
    public ResponseEntity<String> mockTrigger(@RequestBody Map<String, String> request) {
        String orderNumber = request.get("orderNumber");
        String channel = request.get("channel");
        if (orderNumber == null || channel == null) {
            return ResponseEntity.badRequest().body("Missing orderNumber or channel");
        }
        String txId = "MOCK-" + channel + "-" + System.currentTimeMillis();
        orderService.completePayment(orderNumber, txId, channel);
        log.info("Successfully triggered mock payment for order: {} on channel: {}", orderNumber, channel);
        return ResponseEntity.ok("success");
    }

    @GetMapping(value = "/mock-terminal", produces = MediaType.TEXT_HTML_VALUE)
    @Profile({"local", "test"})
    public ResponseEntity<String> mockTerminal() {
        String html = """
                <!DOCTYPE html>
                <html lang="zh-CN">
                <head>
                    <meta charset="UTF-8">
                    <title>Klarheit - Sandbox Cashier</title>
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                            background-color: #f0f3f6;
                            margin: 0;
                            padding: 0;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                        }
                        .card {
                            background: rgba(255, 255, 255, 0.9);
                            backdrop-filter: blur(10px);
                            border-radius: 20px;
                            box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.08);
                            border: 1px solid rgba(255, 255, 255, 0.18);
                            padding: 40px;
                            width: 420px;
                            text-align: center;
                        }
                        .brand {
                            font-size: 28px;
                            font-weight: 700;
                            color: #111827;
                            margin-bottom: 5px;
                            letter-spacing: 1px;
                        }
                        .subtitle {
                            font-size: 14px;
                            color: #6b7280;
                            margin-bottom: 30px;
                        }
                        .info-row {
                            display: flex;
                            justify-content: space-between;
                            margin: 15px 0;
                            font-size: 15px;
                            color: #374151;
                        }
                        .info-label {
                            color: #9ca3af;
                        }
                        .info-value {
                            font-weight: 600;
                        }
                        .amount {
                            font-size: 32px;
                            font-weight: 800;
                            color: #059669;
                            margin: 20px 0;
                        }
                        .btn {
                            background-color: #10b981;
                            color: white;
                            border: none;
                            padding: 14px 28px;
                            font-size: 16px;
                            font-weight: 600;
                            border-radius: 12px;
                            cursor: pointer;
                            width: 100%%;
                            transition: all 0.3s ease;
                            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
                        }
                        .btn:hover {
                            background-color: #059669;
                            transform: translateY(-2px);
                            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.3);
                        }
                        .btn-cancel {
                            background-color: transparent;
                            color: #6b7280;
                            border: 1px solid #d1d5db;
                            margin-top: 12px;
                            box-shadow: none;
                        }
                        .btn-cancel:hover {
                            background-color: #f3f4f6;
                            color: #374151;
                            transform: none;
                        }
                        .divider {
                            height: 1px;
                            background-color: #e5e7eb;
                            margin: 20px 0;
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="brand">KLARHEIT</div>
                        <div class="subtitle">Sandbox Payment Terminal</div>
                        <div class="divider"></div>
                        <div class="info-row">
                            <span class="info-label">Order No.</span>
                            <span class="info-value" id="orderNo"></span>
                        </div>
                        <div class="info-row">
                            <span class="info-label">Merchant</span>
                            <span class="info-value">Klarheit Eyewear</span>
                        </div>
                        <div class="divider"></div>
                        <div class="info-row" style="margin-bottom: 5px;">
                            <span class="info-label">Amount Due</span>
                        </div>
                        <div class="amount" id="orderAmount"></div>
                        <button class="btn" onclick="submitPayment()">Confirm Payment (Mock)</button>
                        <button class="btn btn-cancel" onclick="cancelPayment()">Cancel</button>
                    </div>

                    <script>
                        const urlParams = new URLSearchParams(window.location.search);
                        const orderNo = urlParams.get('out_trade_no') || 'N/A';
                        const amount = urlParams.get('total_amount') || '0.00';

                        document.getElementById('orderNo').innerText = orderNo;
                        document.getElementById('orderAmount').innerText = '¥' + amount;

                        function submitPayment() {
                            fetch('/api/v1/payments/callback/mock-trigger', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    orderNumber: orderNo,
                                    channel: 'ALIPAY'
                                })
                            })
                            .then(res => {
                                if (res.ok) {
                                    alert('Payment successful! Redirecting to your account.');
                                    window.location.href = '%FRONTEND_URL%/my-account';
                                } else {
                                    alert('Payment confirmation failed. Please retry.');
                                }
                            })
                            .catch(err => {
                                console.error(err);
                                alert('Network error');
                            });
                        }

                        function cancelPayment() {
                            window.location.href = '%FRONTEND_URL%/checkout';
                        }
                    </script>
                </body>
                </html>
                """.replace("%FRONTEND_URL%", frontendUrl);
        return ResponseEntity.ok(html);
    }
}
