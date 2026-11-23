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
        String finishId,
        Long skuId,
        String sizeSpecSnapshot,
        Integer quoteVersion,
        BigDecimal shippingFee
) {
    public OrderResponseDTO(String orderNumber, String status, BigDecimal totalAmount, String productName, List<String> lensOptionTypes) {
        this(orderNumber, status, totalAmount, productName, lensOptionTypes, null, null, null, null, null, null);
    }

    public OrderResponseDTO(String orderNumber, String status, BigDecimal totalAmount, String productName, List<String> lensOptionTypes, String payData) {
        this(orderNumber, status, totalAmount, productName, lensOptionTypes, payData, null, null, null, null, null);
    }

    public OrderResponseDTO(String orderNumber, String status, BigDecimal totalAmount, String productName, List<String> lensOptionTypes, String payData, String finishId) {
        this(orderNumber, status, totalAmount, productName, lensOptionTypes, payData, finishId, null, null, null, null);
    }
}
