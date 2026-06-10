package com.klarheit.backend;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.klarheit.backend.coupon.Coupon;
import com.klarheit.backend.coupon.CouponRepository;
import com.klarheit.backend.coupon.CouponService;
import com.klarheit.backend.coupon.dto.CouponValidateRequestDTO;
import com.klarheit.backend.coupon.dto.CouponValidateResponseDTO;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CouponServiceTest {

    @Mock
    private CouponRepository couponRepository;

    @InjectMocks
    private CouponService couponService;

    @Test
    void validateCouponSuccessfullyWithFixedAmount() {
        Coupon coupon = Coupon.builder()
                .id(1L)
                .code("WELCOME100")
                .type("FIXED_AMOUNT")
                .value(new BigDecimal("100.00"))
                .minSpend(new BigDecimal("500.00"))
                .active(true)
                .expiresAt(LocalDateTime.now().plusDays(5))
                .maxUsages(10)
                .usedCount(2)
                .build();

        when(couponRepository.findByCodeIgnoreCaseAndActiveTrue("WELCOME100")).thenReturn(Optional.of(coupon));

        CouponValidateRequestDTO request = new CouponValidateRequestDTO("WELCOME100", new BigDecimal("600.00"));
        CouponValidateResponseDTO response = couponService.validateCoupon(request);

        assertThat(response.code()).isEqualTo("WELCOME100");
        assertThat(response.type()).isEqualTo("FIXED_AMOUNT");
        assertThat(response.value()).isEqualByComparingTo(new BigDecimal("100.00"));
        assertThat(response.discountAmount()).isEqualByComparingTo(new BigDecimal("100.00"));
    }

    @Test
    void validateCouponSuccessfullyWithPercentage() {
        Coupon coupon = Coupon.builder()
                .id(2L)
                .code("DISCOUNT15")
                .type("PERCENTAGE")
                .value(new BigDecimal("0.15"))
                .minSpend(new BigDecimal("200.00"))
                .active(true)
                .expiresAt(LocalDateTime.now().plusDays(5))
                .maxUsages(5)
                .usedCount(1)
                .build();

        when(couponRepository.findByCodeIgnoreCaseAndActiveTrue("DISCOUNT15")).thenReturn(Optional.of(coupon));

        CouponValidateRequestDTO request = new CouponValidateRequestDTO("DISCOUNT15", new BigDecimal("300.00"));
        CouponValidateResponseDTO response = couponService.validateCoupon(request);

        // 300 * 0.15 = 45.00
        assertThat(response.discountAmount()).isEqualByComparingTo(new BigDecimal("45.00"));
    }

    @Test
    void validateCouponCappedAtCurrentAmount() {
        Coupon coupon = Coupon.builder()
                .id(3L)
                .code("HUGE200")
                .type("FIXED_AMOUNT")
                .value(new BigDecimal("200.00"))
                .minSpend(BigDecimal.ZERO)
                .active(true)
                .expiresAt(LocalDateTime.now().plusDays(5))
                .maxUsages(5)
                .usedCount(1)
                .build();

        when(couponRepository.findByCodeIgnoreCaseAndActiveTrue("HUGE200")).thenReturn(Optional.of(coupon));

        CouponValidateRequestDTO request = new CouponValidateRequestDTO("HUGE200", new BigDecimal("150.00"));
        CouponValidateResponseDTO response = couponService.validateCoupon(request);

        // Discount is capped at purchase amount (150.00)
        assertThat(response.discountAmount()).isEqualByComparingTo(new BigDecimal("150.00"));
    }

    @Test
    void validateCouponRejectsExpired() {
        Coupon coupon = Coupon.builder()
                .id(4L)
                .code("EXPIRED10")
                .type("FIXED_AMOUNT")
                .value(new BigDecimal("10.00"))
                .minSpend(BigDecimal.ZERO)
                .active(true)
                .expiresAt(LocalDateTime.now().minusDays(1))
                .build();

        when(couponRepository.findByCodeIgnoreCaseAndActiveTrue("EXPIRED10")).thenReturn(Optional.of(coupon));

        CouponValidateRequestDTO request = new CouponValidateRequestDTO("EXPIRED10", new BigDecimal("100.00"));
        assertThatThrownBy(() -> couponService.validateCoupon(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("expired");
    }

    @Test
    void validateCouponRejectsExhaustedUsages() {
        Coupon coupon = Coupon.builder()
                .id(5L)
                .code("MAXED5")
                .type("FIXED_AMOUNT")
                .value(new BigDecimal("10.00"))
                .minSpend(BigDecimal.ZERO)
                .active(true)
                .expiresAt(LocalDateTime.now().plusDays(1))
                .maxUsages(5)
                .usedCount(5)
                .build();

        when(couponRepository.findByCodeIgnoreCaseAndActiveTrue("MAXED5")).thenReturn(Optional.of(coupon));

        CouponValidateRequestDTO request = new CouponValidateRequestDTO("MAXED5", new BigDecimal("100.00"));
        assertThatThrownBy(() -> couponService.validateCoupon(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("fully redeemed");
    }

    @Test
    void validateCouponRejectsBelowMinSpend() {
        Coupon coupon = Coupon.builder()
                .id(6L)
                .code("MIN500")
                .type("FIXED_AMOUNT")
                .value(new BigDecimal("50.00"))
                .minSpend(new BigDecimal("500.00"))
                .active(true)
                .expiresAt(LocalDateTime.now().plusDays(1))
                .build();

        when(couponRepository.findByCodeIgnoreCaseAndActiveTrue("MIN500")).thenReturn(Optional.of(coupon));

        CouponValidateRequestDTO request = new CouponValidateRequestDTO("MIN500", new BigDecimal("400.00"));
        assertThatThrownBy(() -> couponService.validateCoupon(request))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Minimum spend");
    }

    @Test
    void incrementCouponUsageSuccessfully() {
        Coupon coupon = Coupon.builder()
                .id(7L)
                .code("OK123")
                .active(true)
                .build();

        when(couponRepository.findByCodeIgnoreCaseAndActiveTrue("OK123")).thenReturn(Optional.of(coupon));
        when(couponRepository.incrementUsedCount(7L)).thenReturn(1);

        couponService.incrementCouponUsage("OK123");

        verify(couponRepository).incrementUsedCount(7L);
    }

    @Test
    void incrementCouponUsageThrowsOnConcurrencyLimit() {
        Coupon coupon = Coupon.builder()
                .id(8L)
                .code("CONCURRENT")
                .active(true)
                .build();

        when(couponRepository.findByCodeIgnoreCaseAndActiveTrue("CONCURRENT")).thenReturn(Optional.of(coupon));
        // Simulate no rows affected (either max usages reached in another thread or inactive)
        when(couponRepository.incrementUsedCount(8L)).thenReturn(0);

        assertThatThrownBy(() -> couponService.incrementCouponUsage("CONCURRENT"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("exhausted or disabled");
    }
}
