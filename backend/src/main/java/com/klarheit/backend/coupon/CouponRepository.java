package com.klarheit.backend.coupon;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface CouponRepository extends JpaRepository<Coupon, Long> {
    Optional<Coupon> findByCodeIgnoreCaseAndActiveTrue(String code);

    @Modifying
    @Query("UPDATE Coupon c SET c.usedCount = c.usedCount + 1 WHERE c.id = :couponId AND c.usedCount < c.maxUsages AND c.active = true")
    int incrementUsedCount(@Param("couponId") Long couponId);
}
