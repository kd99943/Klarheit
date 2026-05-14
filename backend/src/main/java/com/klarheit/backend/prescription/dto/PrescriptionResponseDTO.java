package com.klarheit.backend.prescription.dto;

import java.math.BigDecimal;

public record PrescriptionResponseDTO(
        Long id,
        String userEmail,
        BigDecimal sphOd,
        BigDecimal sphOs,
        BigDecimal cylOd,
        BigDecimal cylOs,
        Integer axisOd,
        Integer axisOs,
        BigDecimal pd
) {}
