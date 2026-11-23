package com.klarheit.backend.product;

import com.klarheit.backend.order.BusinessClock;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "product_skus",
    uniqueConstraints = @UniqueConstraint(name = "uk_product_sku", columnNames = {"product_id", "finish_id", "size_spec"})
)
public class ProductSku {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "finish_id", nullable = false, length = 64)
    private String finishId;

    @Column(name = "size_spec", nullable = false, length = 64)
    private String sizeSpec;

    @Column(name = "supplier_name", length = 120)
    private String supplierName;

    @Column(name = "on_hand_qty", nullable = false)
    private Integer onHandQty = 0;

    @Column(name = "reserved_qty", nullable = false)
    private Integer reservedQty = 0;

    @Column(name = "committed_qty", nullable = false)
    private Integer committedQty = 0;

    @Column(name = "sales_status", nullable = false, length = 32)
    private String salesStatus = ProductSalesStatus.PAUSED;

    @Column(name = "restock_eta")
    private LocalDate restockEta;

    @Column(name = "unit_cost", precision = 10, scale = 2)
    private BigDecimal unitCost;

    @Column(name = "stocktake_verified", nullable = false)
    private boolean stocktakeVerified = false;

    @Column(name = "stocktake_at")
    private LocalDateTime stocktakeAt;

    @Column(name = "stocktake_by", length = 120)
    private String stocktakeBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = BusinessClock.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (onHandQty == null) onHandQty = 0;
        if (reservedQty == null) reservedQty = 0;
        if (committedQty == null) committedQty = 0;
        if (salesStatus == null || salesStatus.isBlank()) salesStatus = ProductSalesStatus.PAUSED;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = BusinessClock.now();
    }

    public int getAvailableQty() {
        int onHand = onHandQty != null ? onHandQty : 0;
        int reserved = reservedQty != null ? reservedQty : 0;
        int committed = committedQty != null ? committedQty : 0;
        return Math.max(0, onHand - reserved - committed);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Product getProduct() { return product; }
    public void setProduct(Product product) { this.product = product; }
    public String getFinishId() { return finishId; }
    public void setFinishId(String finishId) { this.finishId = finishId; }
    public String getSizeSpec() { return sizeSpec; }
    public void setSizeSpec(String sizeSpec) { this.sizeSpec = sizeSpec; }
    public String getSupplierName() { return supplierName; }
    public void setSupplierName(String supplierName) { this.supplierName = supplierName; }
    public Integer getOnHandQty() { return onHandQty; }
    public void setOnHandQty(Integer onHandQty) { this.onHandQty = onHandQty; }
    public Integer getReservedQty() { return reservedQty; }
    public void setReservedQty(Integer reservedQty) { this.reservedQty = reservedQty; }
    public Integer getCommittedQty() { return committedQty; }
    public void setCommittedQty(Integer committedQty) { this.committedQty = committedQty; }
    public String getSalesStatus() { return salesStatus; }
    public void setSalesStatus(String salesStatus) { this.salesStatus = salesStatus; }
    public LocalDate getRestockEta() { return restockEta; }
    public void setRestockEta(LocalDate restockEta) { this.restockEta = restockEta; }
    public BigDecimal getUnitCost() { return unitCost; }
    public void setUnitCost(BigDecimal unitCost) { this.unitCost = unitCost; }
    public boolean isStocktakeVerified() { return stocktakeVerified; }
    public void setStocktakeVerified(boolean stocktakeVerified) { this.stocktakeVerified = stocktakeVerified; }
    public LocalDateTime getStocktakeAt() { return stocktakeAt; }
    public void setStocktakeAt(LocalDateTime stocktakeAt) { this.stocktakeAt = stocktakeAt; }
    public String getStocktakeBy() { return stocktakeBy; }
    public void setStocktakeBy(String stocktakeBy) { this.stocktakeBy = stocktakeBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
