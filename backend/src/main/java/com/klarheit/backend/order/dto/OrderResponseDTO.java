package com.klarheit.backend.order.dto;

import java.math.BigDecimal;
import java.util.List;

public record OrderResponseDTO(
        String orderNumber,
        String status,
        BigDecimal totalAmount,
        String productName,
        List<String> lensOptionTypes,
        String payData,
        String finishId
) {
    public OrderResponseDTO(String orderNumber, String status, BigDecimal totalAmount, String productName, List<String> lensOptionTypes) {
        this(orderNumber, status, totalAmount, productName, lensOptionTypes, null, null);
    }
    
    public OrderResponseDTO(String orderNumber, String status, BigDecimal totalAmount, String productName, List<String> lensOptionTypes, String payData) {
        this(orderNumber, status, totalAmount, productName, lensOptionTypes, payData, null);
    }
}
