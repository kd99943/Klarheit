package com.klarheit.backend.lens;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "lens_options")
public class LensOption {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 80)
    private String type;
    @Column(name = "index_value", nullable = false, precision = 6, scale = 2)
    private BigDecimal indexValue;
    @Column(name = "additional_price", nullable = false, precision = 10, scale = 2)
    private BigDecimal additionalPrice;
    @Column(nullable = false, length = 32)
    private String category = "OPTION";
    @Column(nullable = false, length = 120)
    private String label = "";
    @Column(nullable = false, length = 512)
    private String description = "";

    public static Builder builder() { return new Builder(); }
    public Long getId() { return id; }
    public String getType() { return type; }
    public BigDecimal getIndexValue() { return indexValue; }
    public BigDecimal getAdditionalPrice() { return additionalPrice; }
    public String getCategory() { return category; }
    public String getLabel() { return label; }
    public String getDescription() { return description; }
    public void setId(Long id) { this.id = id; }
    public void setType(String type) { this.type = type; }
    public void setIndexValue(BigDecimal indexValue) { this.indexValue = indexValue; }
    public void setAdditionalPrice(BigDecimal additionalPrice) { this.additionalPrice = additionalPrice; }
    public void setCategory(String category) { this.category = category; }
    public void setLabel(String label) { this.label = label; }
    public void setDescription(String description) { this.description = description; }

    public static final class Builder {
        private final LensOption instance = new LensOption();
        public Builder id(Long id) { instance.id = id; return this; }
        public Builder type(String type) { instance.type = type; return this; }
        public Builder indexValue(BigDecimal indexValue) { instance.indexValue = indexValue; return this; }
        public Builder additionalPrice(BigDecimal additionalPrice) { instance.additionalPrice = additionalPrice; return this; }
        public Builder category(String category) { instance.category = category; return this; }
        public Builder label(String label) { instance.label = label; return this; }
        public Builder description(String description) { instance.description = description; return this; }
        public LensOption build() { return instance; }
    }
}
