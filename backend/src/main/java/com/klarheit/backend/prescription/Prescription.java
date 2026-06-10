package com.klarheit.backend.prescription;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "prescriptions")
public class Prescription {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sph_od", nullable = false, precision = 6, scale = 2)
    private BigDecimal sphOd;
    @Column(name = "sph_os", nullable = false, precision = 6, scale = 2)
    private BigDecimal sphOs;
    @Column(name = "cyl_od", nullable = false, precision = 6, scale = 2)
    private BigDecimal cylOd;
    @Column(name = "cyl_os", nullable = false, precision = 6, scale = 2)
    private BigDecimal cylOs;
    @Column(name = "axis_od", nullable = false)
    private Integer axisOd;
    @Column(name = "axis_os", nullable = false)
    private Integer axisOs;
    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal pd;
    @Column(name = "user_id", nullable = false)
    private Long userId;

    public static Builder builder() { return new Builder(); }
    public Long getId() { return id; }
    public BigDecimal getSphOd() { return sphOd; }
    public BigDecimal getSphOs() { return sphOs; }
    public BigDecimal getCylOd() { return cylOd; }
    public BigDecimal getCylOs() { return cylOs; }
    public Integer getAxisOd() { return axisOd; }
    public Integer getAxisOs() { return axisOs; }
    public BigDecimal getPd() { return pd; }
    public Long getUserId() { return userId; }
    public void setId(Long id) { this.id = id; }

    public void setSphOd(BigDecimal sphOd) { this.sphOd = sphOd; }
    public void setSphOs(BigDecimal sphOs) { this.sphOs = sphOs; }
    public void setCylOd(BigDecimal cylOd) { this.cylOd = cylOd; }
    public void setCylOs(BigDecimal cylOs) { this.cylOs = cylOs; }
    public void setAxisOd(Integer axisOd) { this.axisOd = axisOd; }
    public void setAxisOs(Integer axisOs) { this.axisOs = axisOs; }
    public void setPd(BigDecimal pd) { this.pd = pd; }
    public void setUserId(Long userId) { this.userId = userId; }

    public static final class Builder {
        private final Prescription instance = new Prescription();
        public Builder id(Long id) { instance.id = id; return this; }
        public Builder sphOd(BigDecimal sphOd) { instance.sphOd = sphOd; return this; }
        public Builder sphOs(BigDecimal sphOs) { instance.sphOs = sphOs; return this; }
        public Builder cylOd(BigDecimal cylOd) { instance.cylOd = cylOd; return this; }
        public Builder cylOs(BigDecimal cylOs) { instance.cylOs = cylOs; return this; }
        public Builder axisOd(Integer axisOd) { instance.axisOd = axisOd; return this; }
        public Builder axisOs(Integer axisOs) { instance.axisOs = axisOs; return this; }
        public Builder pd(BigDecimal pd) { instance.pd = pd; return this; }
        public Builder userId(Long userId) { instance.userId = userId; return this; }
        public Prescription build() { return instance; }
    }
}
