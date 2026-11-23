package com.klarheit.backend.payment;

import java.math.BigDecimal;

public interface PaymentService {
    /**
     * 发起收单支付意向
     */
    PaymentInitiateResult initiatePayment(String orderNumber, BigDecimal amount, String channel);

    /**
     * 向支付网关主动查询订单交易状态
     */
    default PaymentQueryResult queryPayment(String orderNumber, String channel) {
        return PaymentQueryResult.unpaid();
    }

    /**
     * 关闭未支付的网关交易单，防止超时取消后买家继续付款
     */
    default boolean closePayment(String orderNumber, String channel) {
        return true;
    }

    /**
     * Legacy 5-arg refund entrypoint preserved for compatibility with existing mocks/callers.
     */
    default boolean refundPayment(String orderNumber, String gatewayTransactionId, BigDecimal amount, String channel, String reason) {
        return false;
    }

    /**
     * P0-06: Per-request idempotent refund call with unique refundRequestId (out_request_no).
     * Retries of the same refund reuse the same refundRequestId; distinct partial refunds use distinct IDs.
     */
    default RefundResult refundPaymentWithRequestId(
            String orderNumber,
            String gatewayTransactionId,
            BigDecimal amount,
            String channel,
            String reason,
            String refundRequestId) {
        boolean ok = refundPayment(orderNumber, gatewayTransactionId, amount, channel, reason);
        return ok
                ? RefundResult.confirmed(refundRequestId, amount)
                : RefundResult.failed("Payment gateway did not confirm refund");
    }
}
