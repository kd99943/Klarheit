package com.klarheit.backend.order.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record OrderDetailResponseDTO(
    String orderNumber,
    String status,
    BigDecimal totalAmount,
    BigDecimal discountAmount,
    String appliedCouponCode,
    LocalDateTime createdAt,
    LocalDateTime paidAt,
    String customerFirstName,
    String customerLastName,
    String customerEmail,
    String shippingAddress,
    String paymentChannel,
    String gatewayTransactionId,
    String finishId,
    String productName,
    String productImageUrl,
    List<LensOptionDetailDTO> lensOptions,
    PrescriptionDetailsDTO prescription,
    String carrier,
    String trackingNumber
) {
    public record LensOptionDetailDTO(
        String type,
        String label,
        BigDecimal additionalPrice
    ) {}
}
