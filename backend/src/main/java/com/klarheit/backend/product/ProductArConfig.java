package com.klarheit.backend.product;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "product_ar_configs")
public class ProductArConfig {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "finish_id", nullable = false, length = 64)
    private String finishId;

    @Column(name = "finish_label_key", nullable = false, length = 120)
    private String finishLabelKey;

    @Column(name = "lens_label", nullable = false, length = 120)
    private String lensLabel;

    @Column(name = "lens_label_en", nullable = false, length = 120)
    private String lensLabelEn;

    @Column(name = "lens_label_zh", nullable = false, length = 120)
    private String lensLabelZh;

    @Column(name = "fit_label_key", nullable = false, length = 120)
    private String fitLabelKey;

    @Column(name = "frame_color", nullable = false, length = 32)
    private String frameColor;

    @Column(name = "lens_color", nullable = false, length = 32)
    private String lensColor;

    @Column(name = "model_url", length = 1024)
    private String modelUrl;

    @Column(name = "position_x", nullable = false, precision = 6, scale = 4)
    private BigDecimal positionX;

    @Column(name = "position_y", nullable = false, precision = 6, scale = 4)
    private BigDecimal positionY;

    @Column(name = "position_z", nullable = false, precision = 6, scale = 4)
    private BigDecimal positionZ;

    @Column(name = "rotation_x", nullable = false, precision = 6, scale = 4)
    private BigDecimal rotationX;

    @Column(name = "rotation_y", nullable = false, precision = 6, scale = 4)
    private BigDecimal rotationY;

    @Column(name = "rotation_z", nullable = false, precision = 6, scale = 4)
    private BigDecimal rotationZ;

    @Column(name = "scale", nullable = false, precision = 6, scale = 4)
    private BigDecimal scale;

    public static Builder builder() { return new Builder(); }

    public Long getId() { return id; }
    public Product getProduct() { return product; }
    public String getFinishId() { return finishId; }
    public String getFinishLabelKey() { return finishLabelKey; }
    public String getLensLabel() { return lensLabel; }
    public String getLensLabelEn() { return lensLabelEn; }
    public String getLensLabelZh() { return lensLabelZh; }
    public String getFitLabelKey() { return fitLabelKey; }
    public String getFrameColor() { return frameColor; }
    public String getLensColor() { return lensColor; }
    public String getModelUrl() { return modelUrl; }
    public BigDecimal getPositionX() { return positionX; }
    public BigDecimal getPositionY() { return positionY; }
    public BigDecimal getPositionZ() { return positionZ; }
    public BigDecimal getRotationX() { return rotationX; }
    public BigDecimal getRotationY() { return rotationY; }
    public BigDecimal getRotationZ() { return rotationZ; }
    public BigDecimal getScale() { return scale; }

    public void setId(Long id) { this.id = id; }
    public void setProduct(Product product) { this.product = product; }
    public void setFinishId(String finishId) { this.finishId = finishId; }
    public void setFinishLabelKey(String finishLabelKey) { this.finishLabelKey = finishLabelKey; }
    public void setLensLabel(String lensLabel) { this.lensLabel = lensLabel; }
    public void setLensLabelEn(String lensLabelEn) { this.lensLabelEn = lensLabelEn; }
    public void setLensLabelZh(String lensLabelZh) { this.lensLabelZh = lensLabelZh; }
    public void setFitLabelKey(String fitLabelKey) { this.fitLabelKey = fitLabelKey; }
    public void setFrameColor(String frameColor) { this.frameColor = frameColor; }
    public void setLensColor(String lensColor) { this.lensColor = lensColor; }
    public void setModelUrl(String modelUrl) { this.modelUrl = modelUrl; }
    public void setPositionX(BigDecimal positionX) { this.positionX = positionX; }
    public void setPositionY(BigDecimal positionY) { this.positionY = positionY; }
    public void setPositionZ(BigDecimal positionZ) { this.positionZ = positionZ; }
    public void setRotationX(BigDecimal rotationX) { this.rotationX = rotationX; }
    public void setRotationY(BigDecimal rotationY) { this.rotationY = rotationY; }
    public void setRotationZ(BigDecimal rotationZ) { this.rotationZ = rotationZ; }
    public void setScale(BigDecimal scale) { this.scale = scale; }

    public static final class Builder {
        private final ProductArConfig instance = new ProductArConfig();
        public Builder id(Long id) { instance.id = id; return this; }
        public Builder product(Product product) { instance.product = product; return this; }
        public Builder finishId(String finishId) { instance.finishId = finishId; return this; }
        public Builder finishLabelKey(String finishLabelKey) { instance.finishLabelKey = finishLabelKey; return this; }
        public Builder lensLabel(String lensLabel) { instance.lensLabel = lensLabel; return this; }
        public Builder lensLabelEn(String lensLabelEn) { instance.lensLabelEn = lensLabelEn; return this; }
        public Builder lensLabelZh(String lensLabelZh) { instance.lensLabelZh = lensLabelZh; return this; }
        public Builder fitLabelKey(String fitLabelKey) { instance.fitLabelKey = fitLabelKey; return this; }
        public Builder frameColor(String frameColor) { instance.frameColor = frameColor; return this; }
        public Builder lensColor(String lensColor) { instance.lensColor = lensColor; return this; }
        public Builder modelUrl(String modelUrl) { instance.modelUrl = modelUrl; return this; }
        public Builder positionX(BigDecimal positionX) { instance.positionX = positionX; return this; }
        public Builder positionY(BigDecimal positionY) { instance.positionY = positionY; return this; }
        public Builder positionZ(BigDecimal positionZ) { instance.positionZ = positionZ; return this; }
        public Builder rotationX(BigDecimal rotationX) { instance.rotationX = rotationX; return this; }
        public Builder rotationY(BigDecimal rotationY) { instance.rotationY = rotationY; return this; }
        public Builder rotationZ(BigDecimal rotationZ) { instance.rotationZ = rotationZ; return this; }
        public Builder scale(BigDecimal scale) { instance.scale = scale; return this; }
        public ProductArConfig build() { return instance; }
    }
}
