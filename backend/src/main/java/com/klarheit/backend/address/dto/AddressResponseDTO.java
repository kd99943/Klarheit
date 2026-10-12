package com.klarheit.backend.address.dto;

public record AddressResponseDTO(
    Long id,
    String recipientName,
    String phoneNumber,
    String province,
    String city,
    String district,
    String detailAddress,
    boolean isDefault
) {}
