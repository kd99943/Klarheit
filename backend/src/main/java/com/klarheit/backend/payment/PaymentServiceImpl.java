package com.klarheit.backend.payment;

import com.alipay.api.AlipayClient;
import com.alipay.api.DefaultAlipayClient;
import com.alipay.api.request.AlipayTradeCloseRequest;
import com.alipay.api.request.AlipayTradePagePayRequest;
import com.alipay.api.request.AlipayTradeQueryRequest;
import com.alipay.api.request.AlipayTradeRefundRequest;
import com.alipay.api.response.AlipayTradeCloseResponse;
import com.alipay.api.response.AlipayTradePagePayResponse;
import com.alipay.api.response.AlipayTradeQueryResponse;
import com.alipay.api.response.AlipayTradeRefundResponse;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Slf4j
@Service
public class PaymentServiceImpl implements PaymentService {

    private static final String DEFAULT_ALIPAY_SANDBOX_GATEWAY = "https://openapi-sandbox.dl.alipaydev.com/gateway.do";

    @Value("${app.alipay.app-id:}")
    private String alipayAppId;

    @Value("${app.alipay.private-key:}")
    private String alipayPrivateKey;

    @Value("${app.alipay.public-key:}")
    private String alipayPublicKey;

    @Value("${app.alipay.gateway-url:https://openapi-sandbox.dl.alipaydev.com/gateway.do}")
    private String alipayGatewayUrl;

    @Value("${app.alipay.notify-url:}")
    private String alipayNotifyUrl;

    @Value("${app.alipay.return-url:}")
    private String alipayReturnUrl;

    @Value("${app.frontend-url:http://localhost:3000}")
    private String frontendUrl;

    @Value("${app.backend-base-url:http://localhost:8081}")
    private String backendBaseUrl;

    @Value("${app.payment.mock-enabled:false}")
    private boolean mockEnabled;

    private AlipayClient alipayClient;

    private synchronized AlipayClient getAlipayClient() {
        if (alipayClient == null && isAlipayConfigured()) {
            try {
                alipayClient = new DefaultAlipayClient(
                        resolveGatewayUrl(),
                        alipayAppId.trim(),
                        alipayPrivateKey.trim(),
                        "json",
                        "UTF-8",
                        alipayPublicKey.trim(),
                        "RSA2"
                );
                log.info("[Payment] AlipayClient initialized successfully with gateway {}.", resolveGatewayUrl());
            } catch (Exception e) {
                log.error("[Payment] Failed to initialize AlipayClient", e);
            }
        }
        return alipayClient;
    }

    public String resolveGatewayUrl() {
        String raw = alipayGatewayUrl == null ? "" : alipayGatewayUrl.trim();
        if (raw.isEmpty()) {
            return DEFAULT_ALIPAY_SANDBOX_GATEWAY;
        }
        if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
            raw = "https://" + raw;
        }
        while (raw.endsWith("/")) {
            raw = raw.substring(0, raw.length() - 1);
        }
        if (!raw.endsWith("/gateway.do")) {
            raw = raw + "/gateway.do";
        }
        return raw;
    }

    public String resolveNotifyUrl() {
        if (alipayNotifyUrl != null && !alipayNotifyUrl.isBlank()) {
            return alipayNotifyUrl.trim();
        }
        return stripTrailingSlash(backendBaseUrl) + "/api/v1/payments/callback/alipay";
    }

    public String resolveReturnUrl() {
        if (alipayReturnUrl != null && !alipayReturnUrl.isBlank()) {
            return alipayReturnUrl.trim();
        }
        return stripTrailingSlash(frontendUrl) + "/my-orders";
    }

    private String stripTrailingSlash(String url) {
        if (url == null) {
            return "";
        }
        String trimmed = url.trim();
        while (trimmed.endsWith("/")) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        return trimmed;
    }

    @Override
    public PaymentInitiateResult initiatePayment(String orderNumber, BigDecimal amount, String channel) {
        String txId = "TX-" + UUID.randomUUID().toString().replace("-", "").toUpperCase().substring(0, 16);

        if ("WECHAT".equalsIgnoreCase(channel)) {
            if (!mockEnabled) {
                log.error("[Payment] WeChat Pay order initiation rejected in production for order: {}", orderNumber);
                throw new IllegalStateException("WeChat Pay is not enabled in production.");
            }
            log.info("[Payment] Initiating WeChat Pay sandbox mock request for order: {} amount: {}", orderNumber, amount);
            String payData = "weixin://wxpay/bizpayurl?pr=mock_" + orderNumber + "_" + amount;
            return new PaymentInitiateResult(txId, payData);
        } else if ("ALIPAY".equalsIgnoreCase(channel)) {
            AlipayClient client = getAlipayClient();
            if (client != null) {
                log.info("[Payment] Initiating actual Alipay request for order: {} amount: {}", orderNumber, amount);
                try {
                    AlipayTradePagePayRequest request = new AlipayTradePagePayRequest();
                    request.setReturnUrl(resolveReturnUrl());
                    request.setNotifyUrl(resolveNotifyUrl());

                    request.setBizContent("{" +
                            "\"out_trade_no\":\"" + orderNumber + "\"," +
                            "\"total_amount\":\"" + amount.toPlainString() + "\"," +
                            "\"currency\":\"CNY\"," +
                            "\"subject\":\"Klarheit Eyewear Order - " + orderNumber + "\"," +
                            "\"timeout_express\":\"30m\"," +
                            "\"product_code\":\"FAST_INSTANT_TRADE_PAY\"" +
                            "}");

                    AlipayTradePagePayResponse response = client.pageExecute(request);
                    if (response != null && response.isSuccess() && response.getBody() != null && !response.getBody().isBlank()) {
                        return new PaymentInitiateResult(txId, response.getBody());
                    } else {
                        String errMsg = response != null ? response.getMsg() : "empty response";
                        log.error("[Payment] Alipay PagePay request failed for order {}: {}", orderNumber, errMsg);
                        throw new IllegalStateException("Failed to initiate Alipay payment: " + errMsg);
                    }
                } catch (IllegalStateException e) {
                    throw e;
                } catch (Exception e) {
                    log.error("[Payment] Exception during Alipay PagePay execution for order {}", orderNumber, e);
                    throw new IllegalStateException("Failed to initiate Alipay payment.", e);
                }
            } else {
                if (!mockEnabled) {
                    log.error("[Payment] Alipay credentials not configured in production for order: {}", orderNumber);
                    throw new IllegalStateException("Alipay payment gateway is not configured.");
                }
                log.info("[Payment] Alipay credentials not configured (mock mode). Initiating Alipay Mock Form for order: {} amount: {}", orderNumber, amount);
                String payData = buildMockAlipayForm(orderNumber, amount);
                return new PaymentInitiateResult(txId, payData);
            }
        } else {
            throw new IllegalArgumentException("Unsupported payment channel: " + channel);
        }
    }

    @Override
    public PaymentQueryResult queryPayment(String orderNumber, String channel) {
        if ("ALIPAY".equalsIgnoreCase(channel)) {
            AlipayClient client = getAlipayClient();
            if (client == null) {
                return mockEnabled ? PaymentQueryResult.unpaid() : PaymentQueryResult.unknown("Alipay not configured");
            }
            try {
                AlipayTradeQueryRequest request = new AlipayTradeQueryRequest();
                request.setBizContent("{\"out_trade_no\":\"" + sanitizeOrderNumber(orderNumber) + "\"}");
                AlipayTradeQueryResponse response = client.execute(request);
                if (response == null) {
                    return PaymentQueryResult.unknown("Null response from Alipay query");
                }
                if (response.isSuccess()) {
                    String tradeStatus = response.getTradeStatus();
                    if ("TRADE_SUCCESS".equalsIgnoreCase(tradeStatus) || "TRADE_FINISHED".equalsIgnoreCase(tradeStatus)) {
                        BigDecimal paidAmount = parseDecimal(response.getTotalAmount());
                        if (paidAmount == null || paidAmount.signum() <= 0) {
                            return PaymentQueryResult.unknown("Alipay returned a paid trade without a valid amount");
                        }
                        return PaymentQueryResult.paid(response.getTradeNo(), paidAmount);
                    }
                    if ("TRADE_CLOSED".equalsIgnoreCase(tradeStatus)) {
                        return PaymentQueryResult.closed(response.getTradeNo());
                    }
                    return PaymentQueryResult.unpaid();
                }
                if ("ACQ.TRADE_NOT_EXIST".equalsIgnoreCase(response.getSubCode())) {
                    return PaymentQueryResult.unpaid();
                }
                return PaymentQueryResult.unknown(response.getSubMsg() != null ? response.getSubMsg() : response.getMsg());
            } catch (Exception e) {
                log.error("[Payment] Exception querying Alipay trade for order {}", orderNumber, e);
                return PaymentQueryResult.unknown(e.getMessage());
            }
        }
        return mockEnabled ? PaymentQueryResult.unpaid() : PaymentQueryResult.unknown("Channel query not configured: " + channel);
    }

    @Override
    public boolean closePayment(String orderNumber, String channel) {
        if ("ALIPAY".equalsIgnoreCase(channel)) {
            AlipayClient client = getAlipayClient();
            if (client == null) {
                return mockEnabled;
            }
            try {
                AlipayTradeCloseRequest request = new AlipayTradeCloseRequest();
                request.setBizContent("{\"out_trade_no\":\"" + sanitizeOrderNumber(orderNumber) + "\"}");
                AlipayTradeCloseResponse response = client.execute(request);
                if (response == null) {
                    return false;
                }
                if (response.isSuccess() || "ACQ.TRADE_NOT_EXIST".equalsIgnoreCase(response.getSubCode())) {
                    return true;
                }
                log.warn("[Payment] Alipay close trade returned subCode={} subMsg={} for order {}",
                        response.getSubCode(), response.getSubMsg(), orderNumber);
                return false;
            } catch (Exception e) {
                log.error("[Payment] Exception closing Alipay trade for order {}", orderNumber, e);
                return false;
            }
        }
        return mockEnabled;
    }

    @Override
    public boolean refundPayment(String orderNumber, String gatewayTransactionId, BigDecimal amount, String channel, String reason) {
        String defaultRequestId = sanitizeOrderNumber(orderNumber) + "-REFUND";
        return refundPaymentWithRequestId(orderNumber, gatewayTransactionId, amount, channel, reason, defaultRequestId).confirmed();
    }

    @Override
    public RefundResult refundPaymentWithRequestId(
            String orderNumber,
            String gatewayTransactionId,
            BigDecimal amount,
            String channel,
            String reason,
            String refundRequestId) {
        String safeRequestId = (refundRequestId != null && !refundRequestId.isBlank())
                ? sanitizeOrderNumber(refundRequestId)
                : sanitizeOrderNumber(orderNumber) + "-REFUND";

        if (mockEnabled && gatewayTransactionId != null && gatewayTransactionId.startsWith("MOCK-")) {
            log.info("[Payment] Mock refund completed for order {} txId {} requestId {}",
                    orderNumber, gatewayTransactionId, safeRequestId);
            return RefundResult.confirmed("MOCK-RF-" + safeRequestId, amount);
        }
        if ("ALIPAY".equalsIgnoreCase(channel)) {
            AlipayClient client = getAlipayClient();
            if (client == null) {
                return RefundResult.failed("Alipay client is not configured");
            }
            try {
                AlipayTradeRefundRequest request = new AlipayTradeRefundRequest();
                String safeOrder = sanitizeOrderNumber(orderNumber);
                String safeAmount = amount != null ? amount.toPlainString() : "0.00";
                String safeReason = (reason != null ? reason : "Order cancelled").replace("\"", "'");
                request.setBizContent("{" +
                        "\"out_trade_no\":\"" + safeOrder + "\"," +
                        (gatewayTransactionId != null && !gatewayTransactionId.isBlank()
                                ? "\"trade_no\":\"" + gatewayTransactionId.replace("\"", "") + "\","
                                : "") +
                        "\"refund_amount\":\"" + safeAmount + "\"," +
                        "\"refund_reason\":\"" + safeReason + "\"," +
                        "\"out_request_no\":\"" + safeRequestId + "\"" +
                        "}");
                AlipayTradeRefundResponse response = client.execute(request);
                if (response != null && response.isSuccess()
                        && ("Y".equalsIgnoreCase(response.getFundChange()) || response.getRefundFee() != null)) {
                    log.info("[Payment] Alipay refund succeeded for order {} out_request_no={}", orderNumber, safeRequestId);
                    String gwRef = (response.getTradeNo() != null && !response.getTradeNo().isBlank())
                            ? response.getTradeNo() + ":" + safeRequestId
                            : safeRequestId;
                    return RefundResult.confirmed(gwRef, amount);
                }
                String err = response != null
                        ? (response.getSubMsg() != null ? response.getSubMsg() : response.getMsg())
                        : "null response";
                log.warn("[Payment] Alipay refund failed for order {} out_request_no={}: code={} subCode={} subMsg={}",
                        orderNumber,
                        safeRequestId,
                        response != null ? response.getCode() : "null",
                        response != null ? response.getSubCode() : "null",
                        response != null ? response.getSubMsg() : "null");
                return RefundResult.failed(err);
            } catch (Exception e) {
                log.error("[Payment] Exception refunding Alipay trade for order {} out_request_no={}", orderNumber, safeRequestId, e);
                return RefundResult.failed(e.getMessage());
            }
        }
        return RefundResult.failed("Unsupported or unconfigured refund channel: " + channel);
    }

    private boolean isAlipayConfigured() {
        return alipayAppId != null && !alipayAppId.isBlank() &&
               alipayPrivateKey != null && !alipayPrivateKey.isBlank() &&
               alipayPublicKey != null && !alipayPublicKey.isBlank();
    }

    private BigDecimal parseDecimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return new BigDecimal(raw.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String sanitizeOrderNumber(String orderNumber) {
        return orderNumber == null ? "" : orderNumber.replaceAll("[^a-zA-Z0-9\\-_]", "");
    }

    private String buildMockAlipayForm(String orderNumber, BigDecimal amount) {
        String safeOrder = sanitizeOrderNumber(orderNumber);
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
