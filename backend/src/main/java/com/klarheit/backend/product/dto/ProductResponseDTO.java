package com.klarheit.backend.product.dto;

import java.math.BigDecimal;
import java.util.List;

public record ProductResponseDTO(
    Long id,
    String name,
    String material,
    String nameEn,
    String nameZh,
    String materialEn,
    String materialZh,
    BigDecimal basePrice,
    String imageUrl,
    String shape,
    String specsSize,
    String detailImages,
    List<ProductArConfigDTO> arConfigs
) {
    public ProductResponseDTO(Long id, String name, String material, BigDecimal basePrice, String imageUrl, String shape, String specsSize, String detailImages, List<ProductArConfigDTO> arConfigs) {
        this(id, name, material, name, name, material, material, basePrice, imageUrl, shape, specsSize, detailImages, arConfigs);
    }
}
