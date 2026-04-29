package com.klarheit.backend.order.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record PrescriptionDetailsDTO(
        @NotNull(message = "SPH OD is required.")
        @DecimalMin(value = "-20.00", message = "SPH OD is out of range.")
        @DecimalMax(value = "20.00", message = "SPH OD is out of range.")
        BigDecimal sphOd,

        @NotNull(message = "SPH OS is required.")
        @DecimalMin(value = "-20.00", message = "SPH OS is out of range.")
        @DecimalMax(value = "20.00", message = "SPH OS is out of range.")
        BigDecimal sphOs,

        @NotNull(message = "CYL OD is required.")
        @DecimalMin(value = "-10.00", message = "CYL OD is out of range.")
        @DecimalMax(value = "10.00", message = "CYL OD is out of range.")
        BigDecimal cylOd,

        @NotNull(message = "CYL OS is required.")
        @DecimalMin(value = "-10.00", message = "CYL OS is out of range.")
        @DecimalMax(value = "10.00", message = "CYL OS is out of range.")
        BigDecimal cylOs,

        @NotNull(message = "Axis OD is required.")
        @Min(value = 0, message = "Axis OD must be between 0 and 180.")
        @Max(value = 180, message = "Axis OD must be between 0 and 180.")
        Integer axisOd,

        @NotNull(message = "Axis OS is required.")
        @Min(value = 0, message = "Axis OS must be between 0 and 180.")
        @Max(value = 180, message = "Axis OS must be between 0 and 180.")
        Integer axisOs,

        @NotNull(message = "PD is required.")
        @DecimalMin(value = "40.00", message = "PD is out of range.")
        @DecimalMax(value = "80.00", message = "PD is out of range.")
        BigDecimal pd) {
}
