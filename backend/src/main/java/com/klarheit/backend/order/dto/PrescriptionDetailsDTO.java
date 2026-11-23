package com.klarheit.backend.order.dto;

import com.klarheit.backend.prescription.validation.ValidDiopter;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record PrescriptionDetailsDTO(
        @NotNull @DecimalMin("-20.00") @DecimalMax("+20.00") @ValidDiopter BigDecimal sphOd,
        @NotNull @DecimalMin("-20.00") @DecimalMax("+20.00") @ValidDiopter BigDecimal sphOs,
        @NotNull @DecimalMin("-10.00") @DecimalMax("+10.00") @ValidDiopter BigDecimal cylOd,
        @NotNull @DecimalMin("-10.00") @DecimalMax("+10.00") @ValidDiopter BigDecimal cylOs,
        @NotNull @DecimalMin("0") @DecimalMax("180") Integer axisOd,
        @NotNull @DecimalMin("0") @DecimalMax("180") Integer axisOs,
        @NotNull @DecimalMin("40.00") @DecimalMax("80.00") BigDecimal pd
) {}
