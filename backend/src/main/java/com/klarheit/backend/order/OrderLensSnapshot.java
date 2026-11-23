package com.klarheit.backend.order;

import java.math.BigDecimal;

public record OrderLensSnapshot(String type, String label, BigDecimal additionalPrice) {
}
