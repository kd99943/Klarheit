package com.klarheit.backend.order;

/**
 * Centralized order status constants.
 *
 * <p>Status transitions (valid source → target):
 * <ul>
 *   <li>{@link #CREATED} → {@link #PENDING_PAYMENT}, {@link #CANCELLED}</li>
 *   <li>{@link #PENDING_PAYMENT} → {@link #PAID}, {@link #CANCELLED}</li>
 *   <li>{@link #CANCELLED} → {@link #REFUND_PENDING}, {@link #REFUNDED} (late payment callback after cancellation)</li>
 *   <li>{@link #PAID} → {@link #SHIPPED}, {@link #REFUND_PENDING}, {@link #REFUNDED}</li>
 *   <li>{@link #REFUND_PENDING} → {@link #REFUNDED}</li>
 *   <li>{@link #SHIPPED} → {@link #DELIVERED}</li>
 * </ul>
 * Any other transition is invalid and should be rejected by callers.</p>
 */
public final class OrderStatus {

    private OrderStatus() {
        // Utility class — no instances.
    }

    /** Order has been created but no payment channel was selected (e.g. dev/mock flow). */
    public static final String CREATED = "CREATED";

    /**
     * Order requires optician compatibility/feasibility review before payment is allowed
     * (e.g. high power/astigmatism or incompatible lens index). No payment gateway initiated yet.
     */
    public static final String AWAITING_REVIEW = "AWAITING_REVIEW";

    /**
     * Optician has confirmed feasibility, revised quote/plan and promised delivery date.
     * Customer must explicitly accept before payment gateway is opened.
     */
    public static final String QUOTE_READY = "QUOTE_READY";

    /** Order is awaiting payment from the selected gateway (Alipay/WeChat). */
    public static final String PENDING_PAYMENT = "PENDING_PAYMENT";

    /** Payment has been confirmed by the gateway callback or reconciliation query. */
    public static final String PAID = "PAID";

    /** Admin has shipped the order; carrier + tracking number are recorded. */
    public static final String SHIPPED = "SHIPPED";

    /** Order has been delivered to the customer. */
    public static final String DELIVERED = "DELIVERED";

    /** Order has been cancelled before payment (timeout or admin action). */
    public static final String CANCELLED = "CANCELLED";

    /**
     * Payment was received for a cancelled order (late callback) or a paid order was cancelled
     * by admin and is awaiting gateway refund completion / retry.
     */
    public static final String REFUND_PENDING = "REFUND_PENDING";

    /** Gateway refund has been completed for a cancelled/late-paid order. */
    public static final String REFUNDED = "REFUNDED";
}
