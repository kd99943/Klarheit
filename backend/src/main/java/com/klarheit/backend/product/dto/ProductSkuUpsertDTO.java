package com.klarheit.backend.product.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record ProductSkuUpsertDTO(
        @NotBlank @Size(max = 64) String finishId,
        @NotBlank @Size(max = 64) String sizeSpec,
        @Size(max = 120) String supplierName,
        @Min(0) Integer onHandQty,
        @Size(max = 32) String salesStatus,
        LocalDate restockEta,
        BigDecimal unitCost
) {}
