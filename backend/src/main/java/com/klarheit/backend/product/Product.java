package com.klarheit.backend.product;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

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
    @Column(name = "base_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal basePrice;
    @Column(name = "image_url", nullable = false, length = 1024)
    private String imageUrl;

    public static Builder builder() { return new Builder(); }
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getMaterial() { return material; }
    public BigDecimal getBasePrice() { return basePrice; }
    public String getImageUrl() { return imageUrl; }
    public void setId(Long id) { this.id = id; }
    public void setName(String name) { this.name = name; }
    public void setMaterial(String material) { this.material = material; }
    public void setBasePrice(BigDecimal basePrice) { this.basePrice = basePrice; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public static final class Builder {
        private final Product instance = new Product();
        public Builder id(Long id) { instance.id = id; return this; }
        public Builder name(String name) { instance.name = name; return this; }
        public Builder material(String material) { instance.material = material; return this; }
        public Builder basePrice(BigDecimal basePrice) { instance.basePrice = basePrice; return this; }
        public Builder imageUrl(String imageUrl) { instance.imageUrl = imageUrl; return this; }
        public Product build() { return instance; }
    }
}
