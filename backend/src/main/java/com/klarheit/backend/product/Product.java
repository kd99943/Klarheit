package com.klarheit.backend.product;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "products")
public class Product {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 120)
    private String name;
    @Column(nullable = false, length = 120)
    private String material;
    @Column(name = "name_en", nullable = false, length = 120)
    private String nameEn;
    @Column(name = "name_zh", nullable = false, length = 120)
    private String nameZh;
    @Column(name = "material_en", nullable = false, length = 120)
    private String materialEn;
    @Column(name = "material_zh", nullable = false, length = 120)
    private String materialZh;
    @Column(name = "base_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal basePrice;
    @Column(name = "image_url", nullable = false, length = 1024)
    private String imageUrl;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProductArConfig> arConfigs = new ArrayList<>();

    @PrePersist
    void onCreate() {
        // Keep name/material in sync with English locale as default
        if (name == null || name.isBlank()) name = nameEn;
        if (material == null || material.isBlank()) material = materialEn;
    }

    public static Builder builder() { return new Builder(); }
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getMaterial() { return material; }
    public String getNameEn() { return nameEn; }
    public String getNameZh() { return nameZh; }
    public String getMaterialEn() { return materialEn; }
    public String getMaterialZh() { return materialZh; }
    public BigDecimal getBasePrice() { return basePrice; }
    public String getImageUrl() { return imageUrl; }
    public void setId(Long id) { this.id = id; }
    public void setName(String name) { this.name = name; }
    public void setMaterial(String material) { this.material = material; }
    public void setNameEn(String nameEn) { this.nameEn = nameEn; }
    public void setNameZh(String nameZh) { this.nameZh = nameZh; }
    public void setMaterialEn(String materialEn) { this.materialEn = materialEn; }
    public void setMaterialZh(String materialZh) { this.materialZh = materialZh; }
    public void setBasePrice(BigDecimal basePrice) { this.basePrice = basePrice; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public List<ProductArConfig> getArConfigs() { return arConfigs; }
    public void setArConfigs(List<ProductArConfig> arConfigs) { this.arConfigs = arConfigs; }

    public static final class Builder {
        private final Product instance = new Product();
        public Builder id(Long id) { instance.id = id; return this; }
        public Builder name(String name) { instance.name = name; return this; }
        public Builder material(String material) { instance.material = material; return this; }
        public Builder nameEn(String nameEn) { instance.nameEn = nameEn; return this; }
        public Builder nameZh(String nameZh) { instance.nameZh = nameZh; return this; }
        public Builder materialEn(String materialEn) { instance.materialEn = materialEn; return this; }
        public Builder materialZh(String materialZh) { instance.materialZh = materialZh; return this; }
        public Builder basePrice(BigDecimal basePrice) { instance.basePrice = basePrice; return this; }
        public Builder imageUrl(String imageUrl) { instance.imageUrl = imageUrl; return this; }
        public Builder arConfigs(List<ProductArConfig> arConfigs) { instance.arConfigs = arConfigs; return this; }
        public Product build() { return instance; }
    }
}
