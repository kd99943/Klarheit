package com.klarheit.backend.aftersales.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.klarheit.backend.order.dto.OrderDetailResponseDTO;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record AfterSalesTicketResponseDTO(
        String ticketNumber,
        String orderNumber,
        String category,
        String reason,
        String contactInfo,
        String status,
        String assignee,
        String resolutionNote,
        LocalDateTime nextContactAt,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        String returnCarrier,
        String returnTrackingNumber,
        LocalDateTime returnReceivedAt,
        String returnQcResult,
        String returnQcNote,
        boolean returnRestocked,
        String remakeOrderNumber,
        String remakeCarrier,
        String remakeTrackingNumber,
        BigDecimal refundAmount,
        String refundTransactionId,
        String financeVerifiedBy,
        LocalDateTime financeVerifiedAt,
        String rootCause,
        String returnReceivedBy,
        String returnQcCheckedBy,
        LocalDateTime returnQcCheckedAt,
        String returnDisposition,
        String returnEvidenceNote,
        BigDecimal remakeCostAmount,
        BigDecimal returnShippingCost,
        BigDecimal confirmedRefundAmount,
        BigDecimal pendingRefundAmount,
        List<OrderDetailResponseDTO.RefundTransactionDTO> refundTransactions
) {
    public AfterSalesTicketResponseDTO(
            String ticketNumber,
            String orderNumber,
            String category,
            String reason,
            String contactInfo,
            String status,
            String assignee,
            String resolutionNote,
            LocalDateTime nextContactAt,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            String returnCarrier,
            String returnTrackingNumber,
            LocalDateTime returnReceivedAt,
            String returnQcResult,
            String returnQcNote,
            boolean returnRestocked,
            String remakeOrderNumber,
            String remakeCarrier,
            String remakeTrackingNumber,
            BigDecimal refundAmount,
            String refundTransactionId,
            String financeVerifiedBy,
            LocalDateTime financeVerifiedAt,
            String rootCause
    ) {
        this(
                ticketNumber, orderNumber, category, reason, contactInfo, status,
                assignee, resolutionNote, nextContactAt, createdAt, updatedAt,
                returnCarrier, returnTrackingNumber, returnReceivedAt, returnQcResult,
                returnQcNote, returnRestocked, remakeOrderNumber, remakeCarrier,
                remakeTrackingNumber, refundAmount, refundTransactionId,
                financeVerifiedBy, financeVerifiedAt, rootCause,
                null, null, null, null, null, null, null,
                refundAmount, BigDecimal.ZERO, List.of()
        );
    }
}
