package com.klarheit.backend.coupon.dto;

import java.math.BigDecimal;

public record CouponValidateResponseDTO(
        String code,
        String type,
        BigDecimal value,
        BigDecimal discountAmount
) {}
