package com.klarheit.backend.order.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CustomerInfoDTO(
        @NotBlank @Size(max = 120) String firstName,
        @Size(max = 120) String lastName,
        @NotBlank @Email String email,
        @NotBlank @Size(max = 512) String shippingAddress,
        @Size(max = 32) String phone,
        @Size(max = 64) String province,
        @Size(max = 64) String city,
        @Size(max = 64) String district,
        @Size(max = 512) String detailAddress
) {
    public CustomerInfoDTO(String firstName, String lastName, String email, String shippingAddress) {
        this(firstName, lastName, email, shippingAddress, null, null, null, null, null);
    }

    public CustomerInfoDTO(String firstName, String lastName, String email, String shippingAddress, String phone) {
        this(firstName, lastName, email, shippingAddress, phone, null, null, null, null);
    }
}
