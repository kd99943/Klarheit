package com.klarheit.backend.coupon;

import com.klarheit.backend.coupon.dto.CouponValidateRequestDTO;
import com.klarheit.backend.coupon.dto.CouponValidateResponseDTO;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CouponService {
    private final CouponRepository couponRepository;

    public CouponService(CouponRepository couponRepository) {
        this.couponRepository = couponRepository;
    }

    @Transactional(readOnly = true)
    public CouponValidateResponseDTO validateCoupon(CouponValidateRequestDTO request) {
        if (request.code() == null || request.code().isBlank()) {
            throw new IllegalArgumentException("Coupon code cannot be empty.");
        }

        Coupon coupon = couponRepository.findByCodeIgnoreCaseAndActiveTrue(request.code().trim())
                .orElseThrow(() -> new IllegalArgumentException("Coupon code does not exist or has been disabled."));

        if (coupon.getExpiresAt() != null && coupon.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new IllegalArgumentException("This coupon code has expired.");
        }

        if (coupon.getUsedCount() >= coupon.getMaxUsages()) {
            throw new IllegalArgumentException("This coupon code has been fully redeemed.");
        }

        if (request.currentAmount().compareTo(coupon.getMinSpend()) < 0) {
            throw new IllegalArgumentException("Minimum spend of " + coupon.getMinSpend() + " is required for this coupon.");
        }

        BigDecimal discountAmount = BigDecimal.ZERO;
        if ("FIXED_AMOUNT".equalsIgnoreCase(coupon.getType())) {
            discountAmount = coupon.getValue();
        } else if ("PERCENTAGE".equalsIgnoreCase(coupon.getType())) {
            discountAmount = request.currentAmount().multiply(coupon.getValue());
        }

        if (discountAmount.compareTo(request.currentAmount()) > 0) {
            discountAmount = request.currentAmount();
        }

        discountAmount = discountAmount.setScale(2, RoundingMode.HALF_UP);

        return new CouponValidateResponseDTO(
                coupon.getCode(),
                coupon.getType(),
                coupon.getValue(),
                discountAmount
        );
    }

    @Transactional
    public void incrementCouponUsage(String code) {
        if (code == null || code.isBlank()) {
            return;
        }

        Coupon coupon = couponRepository.findByCodeIgnoreCaseAndActiveTrue(code.trim())
                .orElseThrow(() -> new IllegalArgumentException("Coupon code does not exist or has been disabled."));

        int rowsAffected = couponRepository.incrementUsedCount(coupon.getId());
        if (rowsAffected == 0) {
            throw new IllegalStateException("Coupon redemption failed — it may have been exhausted or disabled.");
        }
    }
}
