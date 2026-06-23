package com.klarheit.backend.payment;

import com.klarheit.backend.order.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
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

        // Do not log raw params in production — may contain sensitive data
        log.info("Received Alipay callback for trade_no: {}", params.get("trade_no"));

        String outTradeNo = params.get("out_trade_no");
        String tradeStatus = params.get("trade_status");
        String tradeNo = params.get("trade_no");

        // --- Signature verification ---
        // Production: integrate Alipay SDK and call:
        //   boolean signVerified = AlipaySignature.rsaCheckV1(params, alipayPublicKey, "UTF-8", "RSA2");
        // For sandbox/MVP: verify HMAC-SHA256 signature using shared callback secret.
        String sign = params.get("sign");
        if (callbackSecret == null || callbackSecret.isBlank()) {
            log.warn("Alipay callback rejected: no callback secret configured (app.payment.callback-secret)");
            return ResponseEntity.badRequest().body("failure");
        }
        if (!verifyHmacSignature(params, sign, callbackSecret)) {
            log.warn("Alipay callback rejected: signature verification failed for out_trade_no: {}", outTradeNo);
            return ResponseEntity.badRequest().body("failure");
        }

        if ("TRADE_SUCCESS".equals(tradeStatus) && outTradeNo != null) {
            String txId = tradeNo != null ? tradeNo : "ALIPAY-TX-" + System.currentTimeMillis();
            orderService.completePayment(outTradeNo, txId, "ALIPAY");
        }

        return ResponseEntity.ok("success");
    }

    @PostMapping("/wechat")
    public ResponseEntity<String> handleWeChatCallback(@RequestBody String xmlData) {
        log.info("Received WeChat Pay callback notification");

        // Basic XML field extraction for sandbox/mock usage
        String outTradeNo = extractXmlField(xmlData, "out_trade_no");
        String transactionId = extractXmlField(xmlData, "transaction_id");
        String resultCode = extractXmlField(xmlData, "result_code");
        String sign = extractXmlField(xmlData, "sign");

        // --- Signature verification ---
        // Production: verify HMAC-MD5 signature using WeChat API key per WeChat Pay docs.
        // For sandbox/MVP: verify using shared callback secret.
        String verifyKey = (wechatApiKey != null && !wechatApiKey.isBlank()) ? wechatApiKey : callbackSecret;
        if (verifyKey == null || verifyKey.isBlank()) {
            log.warn("WeChat callback rejected: no verification key configured");
            return ResponseEntity.ok("<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Invalid signature]]></return_msg></xml>");
        }
        if (!verifyHmacSignatureXml(xmlData, sign, verifyKey)) {
            log.warn("WeChat callback rejected: signature verification failed for out_trade_no: {}", outTradeNo);
            return ResponseEntity.ok("<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Invalid signature]]></return_msg></xml>");
        }

        if ("SUCCESS".equals(resultCode) && outTradeNo != null) {
            String txId = transactionId != null ? transactionId : "WECHAT-TX-" + System.currentTimeMillis();
            orderService.completePayment(outTradeNo, txId, "WECHAT");
        }

        String successResponse = "<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>";
        return ResponseEntity.ok(successResponse);
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
        return sign.equals(computed);
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
        return sign.equals(computed);
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
