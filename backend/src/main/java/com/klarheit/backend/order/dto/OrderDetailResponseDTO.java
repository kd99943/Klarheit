package com.klarheit.backend.order.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
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
    String customerPhone,
    String shippingAddress,
    String paymentChannel,
    String gatewayTransactionId,
    String finishId,
    String productName,
    String productImageUrl,
    List<LensOptionDetailDTO> lensOptions,
    PrescriptionDetailsDTO prescription,
    String carrier,
    String trackingNumber,
    String fulfillmentStatus,
    String fulfillmentNote,
    LocalDate estimatedDeliveryDate,
    LocalDateTime deliveredAt,
    String wearerName,
    BigDecimal refundAmount,
    String refundReason,
    Long skuId,
    String sizeSpecSnapshot,
    LocalDate initialPromisedDeliveryDate,
    String deliveryDelayReason,
    Boolean requiresPrepayReview,
    String prepayReviewReason,
    String quoteNote,
    BigDecimal quoteRevisedAmount,
    LocalDateTime customerQuoteConfirmedAt,
    String opticianVerifiedBy,
    LocalDateTime opticianVerifiedAt,
    String qcStatus,
    String qcNote,
    String qcCheckedBy,
    LocalDateTime qcCheckedAt,
    String orderSource,
    BigDecimal variableCostAmount,
    String parentOrderNumber,
    Integer quoteVersion,
    LocalDateTime quoteExpiresAt,
    LocalDateTime reviewExpiresAt,
    String quoteChangeSummary,
    Integer prescriptionVersion,
    Integer opticianVerifiedRxVersion,
    LocalDateTime firstShippedAt,
    String shippingProvince,
    String shippingCity,
    String shippingDistrict,
    String shippingDetailAddress,
    BigDecimal shippingFee,
    Boolean deliveryReviewRequired,
    String initialPromisedSource,
    BigDecimal confirmedRefundAmount,
    BigDecimal pendingRefundAmount,
    Boolean returnRestocked,
    String returnRestockedByTicket,
    List<QuoteVersionSummaryDTO> quoteHistory,
    List<RefundTransactionDTO> refundTransactions,
    List<ShipmentEventDTO> shipmentEvents
) {
    public OrderDetailResponseDTO(
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
        String customerPhone,
        String shippingAddress,
        String paymentChannel,
        String gatewayTransactionId,
        String finishId,
        String productName,
        String productImageUrl,
        List<LensOptionDetailDTO> lensOptions,
        PrescriptionDetailsDTO prescription,
        String carrier,
        String trackingNumber,
        String fulfillmentStatus,
        String fulfillmentNote,
        LocalDate estimatedDeliveryDate,
        LocalDateTime deliveredAt,
        String wearerName,
        BigDecimal refundAmount,
        String refundReason,
        Long skuId,
        String sizeSpecSnapshot,
        LocalDate initialPromisedDeliveryDate,
        String deliveryDelayReason,
        Boolean requiresPrepayReview,
        String prepayReviewReason,
        String quoteNote,
        BigDecimal quoteRevisedAmount,
        LocalDateTime customerQuoteConfirmedAt,
        String opticianVerifiedBy,
        LocalDateTime opticianVerifiedAt,
        String qcStatus,
        String qcNote,
        String qcCheckedBy,
        LocalDateTime qcCheckedAt,
        String orderSource,
        BigDecimal variableCostAmount,
        String parentOrderNumber
    ) {
        this(
            orderNumber, status, totalAmount, discountAmount, appliedCouponCode,
            createdAt, paidAt, customerFirstName, customerLastName, customerEmail,
            customerPhone, shippingAddress, paymentChannel, gatewayTransactionId,
            finishId, productName, productImageUrl, lensOptions, prescription,
            carrier, trackingNumber, fulfillmentStatus, fulfillmentNote, estimatedDeliveryDate,
            deliveredAt, wearerName, refundAmount, refundReason,
            skuId, sizeSpecSnapshot, initialPromisedDeliveryDate, deliveryDelayReason,
            requiresPrepayReview, prepayReviewReason, quoteNote, quoteRevisedAmount,
            customerQuoteConfirmedAt, opticianVerifiedBy, opticianVerifiedAt, qcStatus,
            qcNote, qcCheckedBy, qcCheckedAt, orderSource, variableCostAmount, parentOrderNumber,
            0, null, null, null, 1, null, null,
            null, null, null, null, BigDecimal.ZERO, false, null,
            refundAmount != null ? refundAmount : BigDecimal.ZERO, BigDecimal.ZERO,
            false, null, List.of(), List.of(), List.of()
        );
    }

    public OrderDetailResponseDTO(
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
        String customerPhone,
        String shippingAddress,
        String paymentChannel,
        String gatewayTransactionId,
        String finishId,
        String productName,
        String productImageUrl,
        List<LensOptionDetailDTO> lensOptions,
        PrescriptionDetailsDTO prescription,
        String carrier,
        String trackingNumber,
        String fulfillmentStatus,
        String fulfillmentNote,
        LocalDate estimatedDeliveryDate,
        LocalDateTime deliveredAt,
        String wearerName,
        BigDecimal refundAmount,
        String refundReason
    ) {
        this(
            orderNumber, status, totalAmount, discountAmount, appliedCouponCode,
            createdAt, paidAt, customerFirstName, customerLastName, customerEmail,
            customerPhone, shippingAddress, paymentChannel, gatewayTransactionId,
            finishId, productName, productImageUrl, lensOptions, prescription,
            carrier, trackingNumber, fulfillmentStatus, fulfillmentNote, estimatedDeliveryDate,
            deliveredAt, wearerName, refundAmount, refundReason,
            null, null, estimatedDeliveryDate, null, false, null, null, null, null,
            null, null, null, null, null, null, null, null, null
        );
    }

    public OrderDetailResponseDTO(
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
        String customerPhone,
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
        this(
            orderNumber, status, totalAmount, discountAmount, appliedCouponCode,
            createdAt, paidAt, customerFirstName, customerLastName, customerEmail,
            customerPhone, shippingAddress, paymentChannel, gatewayTransactionId,
            finishId, productName, productImageUrl, lensOptions, prescription,
            carrier, trackingNumber, "PENDING_REVIEW", null, null, null, null, null, null
        );
    }

    public OrderDetailResponseDTO(
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
        this(
            orderNumber, status, totalAmount, discountAmount, appliedCouponCode,
            createdAt, paidAt, customerFirstName, customerLastName, customerEmail,
            null, shippingAddress, paymentChannel, gatewayTransactionId,
            finishId, productName, productImageUrl, lensOptions, prescription,
            carrier, trackingNumber, "PENDING_REVIEW", null, null, null, null, null, null
        );
    }

    public record LensOptionDetailDTO(
        String type,
        String label,
        BigDecimal additionalPrice
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record QuoteVersionSummaryDTO(
        Integer versionNumber,
        Long skuId,
        String finishId,
        String sizeSpec,
        List<LensOptionDetailDTO> lensOptions,
        BigDecimal quotedAmount,
        LocalDate promisedDeliveryDate,
        LocalDateTime expiresAt,
        String quoteNote,
        String changeSummary,
        LocalDateTime createdAt,
        LocalDateTime confirmedAt
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record RefundTransactionDTO(
        String refundRequestId,
        String ticketNumber,
        BigDecimal requestedAmount,
        BigDecimal confirmedAmount,
        String status,
        String paymentChannel,
        String gatewayRefundId,
        String manualVoucherRef,
        String reason,
        String failureMessage,
        LocalDateTime requestedAt,
        LocalDateTime confirmedAt,
        String financeVerifiedBy,
        LocalDateTime financeVerifiedAt
    ) {}

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ShipmentEventDTO(
        String eventType,
        String carrier,
        String trackingNumber,
        String previousCarrier,
        String previousTrackingNumber,
        String note,
        LocalDateTime createdAt
    ) {}
}
