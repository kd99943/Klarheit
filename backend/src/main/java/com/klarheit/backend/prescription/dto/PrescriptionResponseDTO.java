package com.klarheit.backend.prescription.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PrescriptionResponseDTO(
        Long id,
        String userEmail,
        BigDecimal sphOd,
        BigDecimal sphOs,
        BigDecimal cylOd,
        BigDecimal cylOs,
        Integer axisOd,
        Integer axisOs,
        BigDecimal pd,
        boolean savedToProfile,
        String wearerName,
        String sourceNote,
        LocalDateTime createdAt
) {
    public PrescriptionResponseDTO(
            Long id,
            String userEmail,
            BigDecimal sphOd,
            BigDecimal sphOs,
            BigDecimal cylOd,
            BigDecimal cylOs,
            Integer axisOd,
            Integer axisOs,
            BigDecimal pd
    ) {
        this(id, userEmail, sphOd, sphOs, cylOd, cylOs, axisOd, axisOs, pd, true, null, null, null);
    }
}
