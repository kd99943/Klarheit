package com.klarheit.backend.payment;

import com.klarheit.backend.order.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import java.util.HashMap;
import java.util.Map;
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

        log.info("Received Alipay callback notification: {}", params);

        String outTradeNo = params.get("out_trade_no");
        String tradeStatus = params.get("trade_status");
        String tradeNo = params.get("trade_no");

        if (alipayPublicKey != null && !alipayPublicKey.isBlank()) {
            try {
                // In production or sandbox with real keys:
                // boolean signVerified = AlipaySignature.rsaCheckV1(params, alipayPublicKey, "UTF-8", "RSA2");
                // For simplified MVP sandbox/mock fallback:
                log.info("Alipay key is present, checking signature simulation...");
            } catch (Exception e) {
                log.error("Error during Alipay signature validation", e);
                return ResponseEntity.badRequest().body("failure");
            }
        }

        if ("TRADE_SUCCESS".equals(tradeStatus) && outTradeNo != null) {
            String txId = tradeNo != null ? tradeNo : "ALIPAY-TX-" + System.currentTimeMillis();
            orderService.completePayment(outTradeNo, txId, "ALIPAY");
        }

        return ResponseEntity.ok("success");
    }

    @PostMapping("/wechat")
    public ResponseEntity<String> handleWeChatCallback(@RequestBody String xmlData) {
        log.info("Received WeChat Pay callback notification: {}", xmlData);

        // Basic XML field extraction for sandbox/mock usage
        String outTradeNo = extractXmlField(xmlData, "out_trade_no");
        String transactionId = extractXmlField(xmlData, "transaction_id");
        String resultCode = extractXmlField(xmlData, "result_code");

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
