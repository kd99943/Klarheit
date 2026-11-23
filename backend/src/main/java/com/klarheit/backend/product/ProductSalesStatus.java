package com.klarheit.backend.product;

/**
 * Product sales availability status.
 */
public final class ProductSalesStatus {

    private ProductSalesStatus() {}

    public static final String AVAILABLE = "AVAILABLE";
    public static final String OUT_OF_STOCK = "OUT_OF_STOCK";
    public static final String PAUSED = "PAUSED";
    public static final String ARCHIVED = "ARCHIVED";

    public static boolean isValid(String value) {
        if (value == null) return false;
        return switch (value.trim().toUpperCase()) {
            case AVAILABLE, OUT_OF_STOCK, PAUSED, ARCHIVED -> true;
            default -> false;
        };
    }
}
