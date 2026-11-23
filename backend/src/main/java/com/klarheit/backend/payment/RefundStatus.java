package com.klarheit.backend.payment;

/**
 * Lifecycle status for an individual itemized refund transaction (P0-06).
 */
public final class RefundStatus {
    private RefundStatus() {}

    /** Refund requested by customer/ops, not yet dispatched to channel. */
    public static final String REQUESTED = "REQUESTED";
    /** Submitted to payment gateway or awaiting asynchronous channel confirmation. */
    public static final String PENDING_CHANNEL = "PENDING_CHANNEL";
    /** Channel confirmed or finance verified with real voucher/transaction reference. */
    public static final String CONFIRMED = "CONFIRMED";
    /** Gateway call failed; eligible for retry using the SAME refundRequestId or manual finance takeover. */
    public static final String FAILED = "FAILED";
    /** Request cancelled before funds moved. */
    public static final String CANCELLED = "CANCELLED";
}
