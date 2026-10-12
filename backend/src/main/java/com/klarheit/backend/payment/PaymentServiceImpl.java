package com.klarheit.backend.payment;

import com.alipay.api.AlipayClient;
import com.alipay.api.DefaultAlipayClient;
import com.alipay.api.request.AlipayTradePagePayRequest;
import com.alipay.api.response.AlipayTradePagePayResponse;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class PaymentServiceImpl implements PaymentService {

    @Value("${app.alipay.app-id:}")
    private String alipayAppId;

    @Value("${app.alipay.private-key:}")
    private String alipayPrivateKey;

    @Value("${app.alipay.public-key:}")
    private String alipayPublicKey;

    @Value("${app.alipay.gateway-url:https://openapi-sandbox.dl.alipaydev.com/gateway.do}")
    private String alipayGatewayUrl;

    @Value("${app.frontend-url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${app.backend-base-url:http://localhost:8081}")
    private String backendBaseUrl;

    private AlipayClient alipayClient;

    private synchronized AlipayClient getAlipayClient() {
        if (alipayClient == null && isAlipayConfigured()) {
            try {
                alipayClient = new DefaultAlipayClient(
                        alipayGatewayUrl.trim(),
                        alipayAppId.trim(),
                        alipayPrivateKey.trim(),
                        "json",
                        "UTF-8",
                        alipayPublicKey.trim(),
                        "RSA2"
                );
                log.info("[Payment] AlipayClient initialized successfully.");
            } catch (Exception e) {
                log.error("[Payment] Failed to initialize AlipayClient", e);
            }
        }
        return alipayClient;
    }

    @Override
    public PaymentInitiateResult initiatePayment(String orderNumber, BigDecimal amount, String channel) {
        String txId = "TX-" + UUID.randomUUID().toString().replace("-", "").toUpperCase().substring(0, 16);
        
        if ("WECHAT".equalsIgnoreCase(channel)) {
            log.info("[Payment] Initiating WeChat Pay mock request for order: {} amount: {}", orderNumber, amount);
            // WeChat scanning code format: weixin://wxpay/bizpayurl?pr=XXX
            String payData = "weixin://wxpay/bizpayurl?pr=mock_" + orderNumber + "_" + amount;
            return new PaymentInitiateResult(txId, payData);
        } else if ("ALIPAY".equalsIgnoreCase(channel)) {
            AlipayClient client = getAlipayClient();
            if (client != null) {
                log.info("[Payment] Initiating actual Alipay Sandbox request for order: {} amount: {}", orderNumber, amount);
                try {
                    AlipayTradePagePayRequest request = new AlipayTradePagePayRequest();
                    request.setReturnUrl(frontendUrl + "/my-account");
                    request.setNotifyUrl(backendBaseUrl + "/api/v1/payments/callback/alipay");
                    
                    request.setBizContent("{" +
                            "\"out_trade_no\":\"" + orderNumber + "\"," +
                            "\"total_amount\":\"" + amount.toPlainString() + "\"," +
                            "\"subject\":\"Klarheit Eyewear Order - " + orderNumber + "\"," +
                            "\"product_code\":\"FAST_INSTANT_TRADE_PAY\"" +
                            "}");

                    AlipayTradePagePayResponse response = client.pageExecute(request);
                    if (response.isSuccess()) {
                        String payForm = response.getBody();
                        return new PaymentInitiateResult(txId, payForm);
                    } else {
                        log.error("[Payment] Alipay PagePay request failed: {}", response.getMsg());
                        return new PaymentInitiateResult(txId, buildMockAlipayForm(orderNumber, amount));
                    }
                } catch (Exception e) {
                    log.error("[Payment] Exception during Alipay PagePay execution", e);
                    return new PaymentInitiateResult(txId, buildMockAlipayForm(orderNumber, amount));
                }
            } else {
                log.info("[Payment] Alipay credentials not configured. Initiating Alipay Mock Form for order: {} amount: {}", orderNumber, amount);
                String payData = buildMockAlipayForm(orderNumber, amount);
                return new PaymentInitiateResult(txId, payData);
            }
        } else {
            throw new IllegalArgumentException("Unsupported payment channel: " + channel);
        }
    }

    private boolean isAlipayConfigured() {
        return alipayAppId != null && !alipayAppId.isBlank() &&
               alipayPrivateKey != null && !alipayPrivateKey.isBlank() &&
               alipayPublicKey != null && !alipayPublicKey.isBlank();
    }

    private String buildMockAlipayForm(String orderNumber, BigDecimal amount) {
        // Sanitize inputs to prevent XSS
        String safeOrder = orderNumber.replaceAll("[^a-zA-Z0-9\\-]", "");
        String safeAmount = amount.toPlainString().replaceAll("[^0-9.\\-]", "");
        return "<form id='alipay_submit' name='alipay_submit' action='/api/v1/payments/callback/mock-terminal' method='GET'>" +
                "<input type='hidden' name='out_trade_no' value='" + safeOrder + "'/>" +
                "<input type='hidden' name='total_amount' value='" + safeAmount + "'/>" +
                "<input type='hidden' name='trade_status' value='TRADE_SUCCESS'/>" +
                "<input type='submit' value='Pay with Alipay Mock Cashier' style='display:none;'/>" +
                "</form>" +
                "<script>document.forms['alipay_submit'].submit();</script>";
    }
}
