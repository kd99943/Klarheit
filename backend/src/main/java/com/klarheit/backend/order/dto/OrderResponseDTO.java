package com.klarheit.backend.order.dto;

import java.math.BigDecimal;
import java.util.List;

public record OrderResponseDTO(
        String orderNumber,
        String status,
        BigDecimal totalAmount,
        String productName,
        List<String> lensOptionTypes) {
}
