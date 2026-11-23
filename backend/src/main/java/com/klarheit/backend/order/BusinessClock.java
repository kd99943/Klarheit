package com.klarheit.backend.order;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;

/**
 * Centralized business timezone helper (Asia/Shanghai) so delivery promises,
 * on-time SLA checks, hold deadlines, and daily financial reconciliation use one
 * consistent calendar boundary regardless of host JVM timezone.
 */
public final class BusinessClock {
    public static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Shanghai");

    private BusinessClock() {}

    public static LocalDate today() {
        return LocalDate.now(BUSINESS_ZONE);
    }

    public static LocalDateTime now() {
        return LocalDateTime.now(BUSINESS_ZONE);
    }
}
