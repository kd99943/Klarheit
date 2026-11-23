package com.klarheit.backend.aftersales.dto;

import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record AfterSalesTicketUpdateDTO(
        @Size(max = 32) String status,
        @Size(max = 120) String assignee,
        @Size(max = 1000) String resolutionNote,
        LocalDateTime nextContactAt,
        @Size(max = 100) String returnCarrier,
        @Size(max = 100) String returnTrackingNumber,
        LocalDateTime returnReceivedAt,
        @Size(max = 32) String returnQcResult,
        @Size(max = 512) String returnQcNote,
        @Size(max = 64) String remakeOrderNumber,
        @Size(max = 100) String remakeCarrier,
        @Size(max = 100) String remakeTrackingNumber,
        @Size(max = 64) String rootCause,
        @Size(max = 64) String returnDisposition,
        @Size(max = 512) String returnEvidenceNote,
        BigDecimal remakeCostAmount,
        BigDecimal returnShippingCost
) {
    public AfterSalesTicketUpdateDTO(String status, String assignee, String resolutionNote, LocalDateTime nextContactAt) {
        this(status, assignee, resolutionNote, nextContactAt, null, null, null, null, null, null, null, null, null, null, null, null, null);
    }

    public AfterSalesTicketUpdateDTO(
            String status,
            String assignee,
            String resolutionNote,
            LocalDateTime nextContactAt,
            String returnCarrier,
            String returnTrackingNumber,
            LocalDateTime returnReceivedAt,
            String returnQcResult,
            String returnQcNote,
            String remakeOrderNumber,
            String remakeCarrier,
            String remakeTrackingNumber,
            String rootCause
    ) {
        this(
                status, assignee, resolutionNote, nextContactAt, returnCarrier,
                returnTrackingNumber, returnReceivedAt, returnQcResult, returnQcNote,
                remakeOrderNumber, remakeCarrier, remakeTrackingNumber, rootCause,
                null, null, null, null
        );
    }
}
