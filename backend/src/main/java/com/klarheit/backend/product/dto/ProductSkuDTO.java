package com.klarheit.backend.product.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProductSkuDTO(
        Long id,
        Long productId,
        String finishId,
        String sizeSpec,
        String supplierName,
        Integer onHandQty,
        Integer reservedQty,
        Integer committedQty,
        Integer availableQty,
        String salesStatus,
        LocalDate restockEta,
        BigDecimal unitCost,
        Boolean inStock,
        Boolean lowStock,
        Boolean stocktakeVerified,
        LocalDateTime stocktakeAt,
        String stocktakeBy
) {
    /**
     * Backward-compatible constructor for internal/admin callers.
     */
    public ProductSkuDTO(
            Long id,
            Long productId,
            String finishId,
            String sizeSpec,
            String supplierName,
            Integer onHandQty,
            Integer reservedQty,
            Integer availableQty,
            String salesStatus,
            LocalDate restockEta,
            BigDecimal unitCost
    ) {
        this(
                id, productId, finishId, sizeSpec, supplierName,
                onHandQty, reservedQty, 0, availableQty, salesStatus, restockEta, unitCost,
                "AVAILABLE".equalsIgnoreCase(salesStatus) && availableQty != null && availableQty > 0,
                "AVAILABLE".equalsIgnoreCase(salesStatus) && availableQty != null && availableQty > 0 && availableQty <= 5,
                null, null, null
        );
    }

    /**
     * Public storefront-safe projection (P0-10): exposes ONLY variant selection & availability hints.
     * Omits supplierName, unitCost, onHandQty, reservedQty, committedQty, availableQty, stocktake metadata.
     */
    public static ProductSkuDTO publicProjection(
            Long id,
            Long productId,
            String finishId,
            String sizeSpec,
            String effectiveSalesStatus,
            LocalDate restockEta,
            boolean inStock,
            boolean lowStock
    ) {
        return new ProductSkuDTO(
                id,
                productId,
                finishId,
                sizeSpec,
                null,
                null,
                null,
                null,
                null,
                effectiveSalesStatus,
                restockEta,
                null,
                inStock,
                lowStock,
                null,
                null,
                null
        );
    }
}
