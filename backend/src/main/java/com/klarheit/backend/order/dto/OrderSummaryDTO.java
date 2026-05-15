package com.klarheit.backend.order.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record OrderSummaryDTO(
        String orderNumber,
        String status,
        BigDecimal totalAmount,
        String productName,
        List<String> lensOptionTypes,
        LocalDateTime createdAt
) {}
