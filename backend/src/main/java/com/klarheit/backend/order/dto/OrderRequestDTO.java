package com.klarheit.backend.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record OrderRequestDTO(
        @NotNull Long productId,
        @NotEmpty List<String> lensOptionTypes,
        @NotNull @Valid CustomerInfoDTO customer,
        @NotNull @Valid PrescriptionDetailsDTO prescription,
        String couponCode,
        String paymentChannel,
        String finishId
) {
    public OrderRequestDTO(Long productId, List<String> lensOptionTypes, CustomerInfoDTO customer, PrescriptionDetailsDTO prescription) {
        this(productId, lensOptionTypes, customer, prescription, null, null, null);
    }

    public OrderRequestDTO(Long productId, List<String> lensOptionTypes, CustomerInfoDTO customer, PrescriptionDetailsDTO prescription, String couponCode, String paymentChannel) {
        this(productId, lensOptionTypes, customer, prescription, couponCode, paymentChannel, null);
    }
}
