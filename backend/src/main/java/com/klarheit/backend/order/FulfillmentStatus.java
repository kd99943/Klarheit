package com.klarheit.backend.order;

/**
 * Optical fulfillment & workshop processing stages, tracked orthogonally from payment status.
 */
public final class FulfillmentStatus {

    private FulfillmentStatus() {}

    /** Order received; awaiting optician prescription & frame compatibility review. */
    public static final String PENDING_REVIEW = "PENDING_REVIEW";

    /** Optician found missing or ambiguous prescription details; awaiting customer follow-up. */
    public static final String NEEDS_INFO = "NEEDS_INFO";

    /** Prescription verified; lenses are being edged & mounted in workshop. */
    public static final String IN_PRODUCTION = "IN_PRODUCTION";

    /** Optical inspection & QC passed; ready to pack and ship. */
    public static final String QC_PASSED = "QC_PASSED";

    /** Handed over to carrier with tracking number. */
    public static final String SHIPPED = "SHIPPED";

    /** Delivered and confirmed receipt. */
    public static final String DELIVERED = "DELIVERED";

    /** Exception flagged (out of stock, factory delay, QC failure, lost parcel). */
    public static final String EXCEPTION = "EXCEPTION";

    public static boolean isValid(String value) {
        if (value == null) return false;
        return switch (value.trim().toUpperCase()) {
            case PENDING_REVIEW, NEEDS_INFO, IN_PRODUCTION, QC_PASSED, SHIPPED, DELIVERED, EXCEPTION -> true;
            default -> false;
        };
    }
}
