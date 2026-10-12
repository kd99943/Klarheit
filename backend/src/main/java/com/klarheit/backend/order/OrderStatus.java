package com.klarheit.backend.order;

/**
 * Centralized order status constants.
 *
 * <p>The Order entity stores its status as a VARCHAR column to preserve
 * forward/backward compatibility with existing rows and to avoid JPA
 * enum-mapping fragility (e.g. unknown values from manual DB edits).
 * Using these constants instead of raw String literals prevents typos
 * such as {@code "PAId"} and makes status transitions greppable.</p>
 *
 * <p>Status transitions (valid source → target):
 * <ul>
 *   <li>{@link #CREATED} → {@link #PENDING_PAYMENT}, {@link #CANCELLED}</li>
 *   <li>{@link #PENDING_PAYMENT} → {@link #PAID}, {@link #CANCELLED}</li>
 *   <li>{@link #PAID} → {@link #SHIPPED}</li>
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

    /** Order is awaiting payment from the selected gateway (Alipay/WeChat). */
    public static final String PENDING_PAYMENT = "PENDING_PAYMENT";

    /** Payment has been confirmed by the gateway callback. */
    public static final String PAID = "PAID";

    /** Admin has shipped the order; carrier + tracking number are recorded. */
    public static final String SHIPPED = "SHIPPED";

    /** Order has been delivered to the customer. */
    public static final String DELIVERED = "DELIVERED";

    /** Order has been cancelled (timeout, admin action, or payment mismatch). */
    public static final String CANCELLED = "CANCELLED";
}
