package com.klarheit.backend.product.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Physical stocktake import row for a single (product, finish, size) SKU (P0-02).
 */
public record StocktakeItemDTO(
        @NotNull Long productId,
        @NotBlank @Size(max = 64) String finishId,
        @NotBlank @Size(max = 64) String sizeSpec,
        @NotNull @Min(0) Integer onHandQty,
        @Min(0) Integer committedQty,
        @Size(max = 120) String supplierName,
        @Size(max = 32) String salesStatus,
        LocalDate restockEta,
        BigDecimal unitCost
) {}
