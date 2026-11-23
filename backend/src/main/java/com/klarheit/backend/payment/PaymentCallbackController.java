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

    @Value("${app.alipay.app-id:}")
    private String alipayAppId;

    @Value("${app.alipay.public-key:}")
    private String alipayPublicKey;

    @Value("${app.payment.callback-secret:}")
    private String callbackSecret;

    @Value("${app.wechat.api-key:}")
    private String wechatApiKey;

    @Value("${app.wechat.platform-public-key:}")
    private String wechatPlatformPublicKey;

    @Value("${app.frontend-url:http://localhost:3000}")
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

        if (alipayAppId != null && !alipayAppId.isBlank()) {
            String callbackAppId = params.get("app_id");
            if (callbackAppId == null || !alipayAppId.trim().equals(callbackAppId.trim())) {
                log.warn("Alipay callback rejected: app_id mismatch for order {} (expected={}, received={})",
                        outTradeNo, alipayAppId.trim(), callbackAppId);
                return ResponseEntity.badRequest().body("failure");
            }
        }

        if (("TRADE_SUCCESS".equals(tradeStatus) || "TRADE_FINISHED".equals(tradeStatus)) && outTradeNo != null) {
            String txId = tradeNo != null ? tradeNo : "ALIPAY-TX-" + System.currentTimeMillis();
            java.math.BigDecimal paidAmount;
            try {
                paidAmount = parseRequiredAmount(params.get("total_amount"));
            } catch (IllegalArgumentException e) {
                log.warn("Alipay callback rejected for order {}: {}", outTradeNo, e.getMessage());
                return ResponseEntity.badRequest().body("failure");
            }
            orderService.completePayment(outTradeNo, txId, "ALIPAY", paidAmount);
        }

        return ResponseEntity.ok("success");
    }

    private java.math.BigDecimal parseRequiredAmount(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("Missing payment amount");
        }
        try {
            java.math.BigDecimal amount = new java.math.BigDecimal(raw.trim());
            if (amount.signum() <= 0 || amount.scale() > 2) {
                throw new IllegalArgumentException("Invalid payment amount precision or sign");
            }
            return amount;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid payment amount", e);
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

                String verifyKey = (wechatApiKey != null && !wechatApiKey.isBlank()) ? wechatApiKey : null;
                if (verifyKey == null) {
                    log.warn("WeChat XML callback rejected: WECHAT_API_KEY is not configured");
                    return ResponseEntity.ok("<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Invalid signature]]></return_msg></xml>");
                }
                if (!verifyHmacSignatureXml(requestBody, sign, verifyKey)) {
                    log.warn("WeChat XML callback rejected: signature verification failed for out_trade_no: {}", outTradeNo);
                    return ResponseEntity.ok("<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Invalid signature]]></return_msg></xml>");
                }

                if ("SUCCESS".equals(resultCode) && outTradeNo != null) {
                    String txId = transactionId != null ? transactionId : "WECHAT-TX-" + System.currentTimeMillis();
                    String rawAmount = extractXmlField(requestBody, "total_amount");
                    if (rawAmount != null && !rawAmount.isBlank()) {
                        java.math.BigDecimal paidAmount = parseRequiredAmount(rawAmount);
                        orderService.completePayment(outTradeNo, txId, "WECHAT", paidAmount);
                    } else {
                        orderService.completePayment(outTradeNo, txId, "WECHAT");
                    }
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
}
