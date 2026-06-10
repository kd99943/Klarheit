package com.klarheit.backend.product.dto;

import java.math.BigDecimal;
import java.util.List;

public record ProductArConfigDTO(
    String id,
    String productName,
    String productNameEn,
    String productNameZh,
    String finishLabelKey,
    String lensLabel,
    String lensLabelEn,
    String lensLabelZh,
    String fitLabelKey,
    String frameColor,
    String lensColor,
    String modelUrl,
    TransformOffsetDTO transformOffset
) {
    public ProductArConfigDTO(String id, String productName, String finishLabelKey, String lensLabel, String fitLabelKey, String frameColor, String lensColor, String modelUrl, TransformOffsetDTO transformOffset) {
        this(id, productName, productName, productName, finishLabelKey, lensLabel, lensLabel, lensLabel, fitLabelKey, frameColor, lensColor, modelUrl, transformOffset);
    }

    public record TransformOffsetDTO(
        List<BigDecimal> position,
        List<BigDecimal> rotation,
        BigDecimal scale
    ) {}
}
