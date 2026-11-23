package com.klarheit.backend.aftersales.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AfterSalesTicketRequestDTO(
        @NotBlank @Size(max = 32) String category,
        @NotBlank @Size(max = 1000) String reason,
        @Size(max = 255) String contactInfo
) {}
