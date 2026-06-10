package com.klarheit.backend.coupon;

import com.klarheit.backend.coupon.dto.CouponValidateRequestDTO;
import com.klarheit.backend.coupon.dto.CouponValidateResponseDTO;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/coupons")
public class CouponController {
    private final CouponService couponService;

    public CouponController(CouponService couponService) {
        this.couponService = couponService;
    }

    @PostMapping("/validate")
    public ResponseEntity<CouponValidateResponseDTO> validateCoupon(@Valid @RequestBody CouponValidateRequestDTO request) {
        return ResponseEntity.ok(couponService.validateCoupon(request));
    }
}
