package com.klarheit.backend.address.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AddressRequestDTO(
    @NotBlank(message = "Recipient name is required")
    @Size(max = 120, message = "Recipient name must be at most 120 characters")
    String recipientName,

    @NotBlank(message = "Phone number is required")
    @Size(max = 20, message = "Phone number must be at most 20 characters")
    String phoneNumber,

    @NotBlank(message = "Province is required")
    @Size(max = 100, message = "Province must be at most 100 characters")
    String province,

    @NotBlank(message = "City is required")
    @Size(max = 100, message = "City must be at most 100 characters")
    String city,

    @Size(max = 100, message = "District must be at most 100 characters")
    String district,

    @NotBlank(message = "Detail address is required")
    @Size(max = 255, message = "Detail address must be at most 255 characters")
    String detailAddress,

    boolean isDefault
) {}
