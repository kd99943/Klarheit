package com.klarheit.backend.product.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
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
    List<ProductArConfigDTO> arConfigs,
    Integer stockQuantity,
    String salesStatus,
    List<ProductSkuDTO> skus,
    Boolean inStock,
    Boolean lowStock
) {
    public ProductResponseDTO(Long id, String name, String material, BigDecimal basePrice, String imageUrl, String shape, String specsSize, String detailImages, List<ProductArConfigDTO> arConfigs) {
        this(id, name, material, name, name, material, material, basePrice, imageUrl, shape, specsSize, detailImages, arConfigs, 50, "AVAILABLE", List.of(), true, false);
    }

    public ProductResponseDTO(
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
        this(id, name, material, nameEn, nameZh, materialEn, materialZh, basePrice, imageUrl, shape, specsSize, detailImages, arConfigs, 50, "AVAILABLE", List.of(), true, false);
    }

    public ProductResponseDTO(
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
            List<ProductArConfigDTO> arConfigs,
            Integer stockQuantity,
            String salesStatus
    ) {
        this(
                id, name, material, nameEn, nameZh, materialEn, materialZh, basePrice,
                imageUrl, shape, specsSize, detailImages, arConfigs, stockQuantity, salesStatus, List.of(),
                "AVAILABLE".equalsIgnoreCase(salesStatus) && (stockQuantity == null || stockQuantity > 0),
                "AVAILABLE".equalsIgnoreCase(salesStatus) && stockQuantity != null && stockQuantity > 0 && stockQuantity <= 5
        );
    }

    public ProductResponseDTO(
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
            List<ProductArConfigDTO> arConfigs,
            Integer stockQuantity,
            String salesStatus,
            List<ProductSkuDTO> skus
    ) {
        this(
                id, name, material, nameEn, nameZh, materialEn, materialZh, basePrice,
                imageUrl, shape, specsSize, detailImages, arConfigs, stockQuantity, salesStatus, skus,
                "AVAILABLE".equalsIgnoreCase(salesStatus) && (stockQuantity == null || stockQuantity > 0),
                "AVAILABLE".equalsIgnoreCase(salesStatus) && stockQuantity != null && stockQuantity > 0 && stockQuantity <= 5
        );
    }
}
