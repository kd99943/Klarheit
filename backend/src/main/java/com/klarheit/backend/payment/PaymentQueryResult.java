package com.klarheit.backend.payment;

import java.math.BigDecimal;

public record PaymentQueryResult(
    PaymentQueryStatus status,
    String gatewayTransactionId,
    BigDecimal paidAmount,
    String message
) {
    public PaymentQueryResult(PaymentQueryStatus status, String gatewayTransactionId, BigDecimal paidAmount) {
        this(status, gatewayTransactionId, paidAmount, null);
    }

    public static PaymentQueryResult paid(String gatewayTransactionId, BigDecimal paidAmount) {
        return new PaymentQueryResult(PaymentQueryStatus.PAID, gatewayTransactionId, paidAmount, "TRADE_SUCCESS");
    }

    public static PaymentQueryResult unpaid() {
        return new PaymentQueryResult(PaymentQueryStatus.UNPAID, null, null, "WAIT_BUYER_PAY");
    }

    public static PaymentQueryResult closed(String gatewayTransactionId) {
        return new PaymentQueryResult(PaymentQueryStatus.CLOSED, gatewayTransactionId, null, "TRADE_CLOSED");
    }

    public static PaymentQueryResult unknown(String message) {
        return new PaymentQueryResult(PaymentQueryStatus.UNKNOWN, null, null, message);
    }
}
