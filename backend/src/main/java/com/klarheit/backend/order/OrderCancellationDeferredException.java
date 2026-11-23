package com.klarheit.backend.order;

/**
 * Thrown when an admin order cancellation request cannot be completed immediately
 * because the payment gateway status is uncertain (UNKNOWN) or trade close failed.
 *
 * <p>Extends {@link IllegalStateException} so API exception handling returns HTTP 409 Conflict
 * with a clear user-facing message, while {@code @Transactional(noRollbackFor = OrderCancellationDeferredException.class)}
 * allows persisting {@code cancelRequested = true} on the order for subsequent reconciliation.</p>
 */
public class OrderCancellationDeferredException extends IllegalStateException {
    public OrderCancellationDeferredException(String message) {
        super(message);
    }
}
