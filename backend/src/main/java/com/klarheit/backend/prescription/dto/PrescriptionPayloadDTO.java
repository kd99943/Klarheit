package com.klarheit.backend.prescription.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;

public record PrescriptionPayloadDTO(
        @NotNull @DecimalMin("-20.00") @DecimalMax("+20.00") BigDecimal sphOd,
        @NotNull @DecimalMin("-20.00") @DecimalMax("+20.00") BigDecimal sphOs,
        @NotNull @DecimalMin("-10.00") @DecimalMax("+10.00") BigDecimal cylOd,
        @NotNull @DecimalMin("-10.00") @DecimalMax("+10.00") BigDecimal cylOs,
        @NotNull @DecimalMin("0") @DecimalMax("180") Integer axisOd,
        @NotNull @DecimalMin("0") @DecimalMax("180") Integer axisOs,
        @NotNull @Positive @DecimalMax("80.00") BigDecimal pd
) {}
