package com.klarheit.backend.coupon;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "coupons")
public class Coupon {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String code;

    @Column(nullable = false, length = 32)
    private String type; // FIXED_AMOUNT, PERCENTAGE

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal value;

    @Column(name = "min_spend", nullable = false, precision = 10, scale = 2)
    private BigDecimal minSpend = BigDecimal.ZERO;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "max_usages", nullable = false)
    private int maxUsages = 9999;

    @Column(name = "used_count", nullable = false)
    private int usedCount = 0;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public static Builder builder() { return new Builder(); }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }

    public BigDecimal getValue() { return value; }
    public void setValue(BigDecimal value) { this.value = value; }

    public BigDecimal getMinSpend() { return minSpend; }
    public void setMinSpend(BigDecimal minSpend) { this.minSpend = minSpend; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }

    public int getMaxUsages() { return maxUsages; }
    public void setMaxUsages(int maxUsages) { this.maxUsages = maxUsages; }

    public int getUsedCount() { return usedCount; }
    public void setUsedCount(int usedCount) { this.usedCount = usedCount; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public static final class Builder {
        private final Coupon instance = new Coupon();

        public Builder id(Long id) { instance.id = id; return this; }
        public Builder code(String code) { instance.code = code; return this; }
        public Builder type(String type) { instance.type = type; return this; }
        public Builder value(BigDecimal value) { instance.value = value; return this; }
        public Builder minSpend(BigDecimal minSpend) { instance.minSpend = minSpend; return this; }
        public Builder active(boolean active) { instance.active = active; return this; }
        public Builder expiresAt(LocalDateTime expiresAt) { instance.expiresAt = expiresAt; return this; }
        public Builder maxUsages(int maxUsages) { instance.maxUsages = maxUsages; return this; }
        public Builder usedCount(int usedCount) { instance.usedCount = usedCount; return this; }
        public Builder createdAt(LocalDateTime createdAt) { instance.createdAt = createdAt; return this; }

        public Coupon build() { return instance; }
    }
}
