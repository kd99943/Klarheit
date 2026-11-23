package com.klarheit.backend.payment;

import java.math.BigDecimal;

/**
 * Structured outcome returned by a payment gateway refund call (P0-06).
 */
public record RefundResult(
        boolean confirmed,
        String gatewayRefundId,
        BigDecimal confirmedAmount,
        String message
) {
    public static RefundResult confirmed(String gatewayRefundId, BigDecimal confirmedAmount) {
        return new RefundResult(true, gatewayRefundId, confirmedAmount, "CONFIRMED");
    }

    public static RefundResult failed(String message) {
        return new RefundResult(false, null, null, message != null ? message : "Gateway refund failed");
    }
}
