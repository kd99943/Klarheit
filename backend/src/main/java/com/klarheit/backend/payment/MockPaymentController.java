package com.klarheit.backend.payment;

import com.klarheit.backend.order.OrderService;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Sandbox/local-only mock payment endpoints.
 *
 * <p>Restricted at the class level so Spring never registers these mappings when
 * running under the {@code prod} profile or when {@code app.payment.mock-enabled}
 * is disabled.</p>
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/payments/callback")
@Profile({"local & !prod", "test & !prod"})
@ConditionalOnProperty(name = "app.payment.mock-enabled", havingValue = "true", matchIfMissing = true)
public class MockPaymentController {

    private final OrderService orderService;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    public MockPaymentController(OrderService orderService) {
        this.orderService = orderService;
    }

    @PostMapping("/mock-trigger")
    public ResponseEntity<String> mockTrigger(@RequestBody Map<String, String> request) {
        String orderNumber = request.get("orderNumber");
        String channel = request.get("channel");
        if (orderNumber == null || orderNumber.isBlank() || channel == null || channel.isBlank()) {
            return ResponseEntity.badRequest().body("Missing orderNumber or channel");
        }
        String txId = "MOCK-" + channel + "-" + System.currentTimeMillis();
        orderService.completePayment(orderNumber, txId, channel);
        log.info("Successfully triggered mock payment for order: {} on channel: {}", orderNumber, channel);
        return ResponseEntity.ok("success");
    }

    @GetMapping(value = "/mock-terminal", produces = MediaType.TEXT_HTML_VALUE)
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
                                    alert('Payment successful! Redirecting to your orders.');
                                    window.location.href = '%FRONTEND_URL%/my-orders?orderNumber=' + encodeURIComponent(orderNo);
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
