package com.klarheit.backend.coupon.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record CouponValidateRequestDTO(
        @NotBlank String code,
        @NotNull BigDecimal currentAmount
) {}
