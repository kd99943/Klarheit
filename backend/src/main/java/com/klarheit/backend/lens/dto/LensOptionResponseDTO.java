package com.klarheit.backend.lens.dto;

import java.math.BigDecimal;

public record LensOptionResponseDTO(
        Long id,
        String type,
        String category,
        String label,
        String description,
        BigDecimal indexValue,
        BigDecimal additionalPrice
) {}
