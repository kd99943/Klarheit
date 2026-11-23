package com.klarheit.backend.order.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record OrderRequestDTO(
        @NotNull Long productId,
        @NotEmpty List<String> lensOptionTypes,
        @NotNull @Valid CustomerInfoDTO customer,
        @NotNull @Valid PrescriptionDetailsDTO prescription,
        String couponCode,
        String paymentChannel,
        String finishId,
        @Size(max = 128) String idempotencyKey,
        @Size(max = 120) String wearerName,
        Boolean savePrescriptionToProfile,
        @Size(max = 64) String sizeSpec,
        @Size(max = 64) String orderSource,
        Long skuId
) {
    public OrderRequestDTO(Long productId, List<String> lensOptionTypes, CustomerInfoDTO customer, PrescriptionDetailsDTO prescription) {
        this(productId, lensOptionTypes, customer, prescription, null, null, null, null, null, null, null, null, null);
    }

    public OrderRequestDTO(Long productId, List<String> lensOptionTypes, CustomerInfoDTO customer, PrescriptionDetailsDTO prescription, String couponCode, String paymentChannel) {
        this(productId, lensOptionTypes, customer, prescription, couponCode, paymentChannel, null, null, null, null, null, null, null);
    }

    public OrderRequestDTO(Long productId, List<String> lensOptionTypes, CustomerInfoDTO customer, PrescriptionDetailsDTO prescription, String couponCode, String paymentChannel, String finishId) {
        this(productId, lensOptionTypes, customer, prescription, couponCode, paymentChannel, finishId, null, null, null, null, null, null);
    }

    public OrderRequestDTO(Long productId, List<String> lensOptionTypes, CustomerInfoDTO customer, PrescriptionDetailsDTO prescription, String couponCode, String paymentChannel, String finishId, String idempotencyKey, String wearerName, Boolean savePrescriptionToProfile) {
        this(productId, lensOptionTypes, customer, prescription, couponCode, paymentChannel, finishId, idempotencyKey, wearerName, savePrescriptionToProfile, null, null, null);
    }

    public OrderRequestDTO(Long productId, List<String> lensOptionTypes, CustomerInfoDTO customer, PrescriptionDetailsDTO prescription, String couponCode, String paymentChannel, String finishId, String idempotencyKey, String wearerName, Boolean savePrescriptionToProfile, String sizeSpec, String orderSource) {
        this(productId, lensOptionTypes, customer, prescription, couponCode, paymentChannel, finishId, idempotencyKey, wearerName, savePrescriptionToProfile, sizeSpec, orderSource, null);
    }
}
