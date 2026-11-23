package com.klarheit.backend.product.dto;

import java.math.BigDecimal;

public record ProductRequestDTO(
    String nameEn,
    String nameZh,
    String materialEn,
    String materialZh,
    BigDecimal basePrice,
    String imageUrl,
    String shape,
    String specsSize,
    String detailImages,
    Integer stockQuantity,
    String salesStatus
) {
    public ProductRequestDTO(
            String nameEn,
            String nameZh,
            String materialEn,
            String materialZh,
            BigDecimal basePrice,
            String imageUrl,
            String shape,
            String specsSize,
            String detailImages
    ) {
        this(nameEn, nameZh, materialEn, materialZh, basePrice, imageUrl, shape, specsSize, detailImages, null, null);
    }
}
