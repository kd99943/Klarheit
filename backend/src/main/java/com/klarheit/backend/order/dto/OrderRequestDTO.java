package com.klarheit.backend.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record OrderRequestDTO(
        @NotNull Long productId,
        @NotEmpty List<String> lensOptionTypes,
        @NotNull @Valid CustomerInfoDTO customer,
        @NotNull @Valid PrescriptionDetailsDTO prescription
) {}
