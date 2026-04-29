package com.klarheit.backend.product.dto;

import java.math.BigDecimal;

public record ProductResponseDTO(
        Long id,
        String name,
        String material,
        BigDecimal basePrice,
        String imageUrl) {
}
