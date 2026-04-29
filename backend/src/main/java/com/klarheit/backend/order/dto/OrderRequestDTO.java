package com.klarheit.backend.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

public record OrderRequestDTO(
        @NotNull(message = "Product id is required.")
        @Positive(message = "Product id must be positive.")
        Long productId,

        @NotEmpty(message = "At least one lens option must be selected.")
        List<String> lensOptionTypes,

        @Valid
        @NotNull(message = "Customer details are required.")
        CustomerInfoDTO customer,

        @Valid
        @NotNull(message = "Prescription details are required.")
        PrescriptionDetailsDTO prescription) {
}
