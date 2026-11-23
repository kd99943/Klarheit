package com.klarheit.backend.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(
    name = "order_quote_versions",
    uniqueConstraints = @UniqueConstraint(name = "uk_order_quote_version", columnNames = {"order_number", "version_number"})
)
public class OrderQuoteVersion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_number", nullable = false, length = 64)
    private String orderNumber;

    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    @Column(name = "product_id")
    private Long productId;

    @Column(name = "sku_id")
    private Long skuId;

    @Column(name = "finish_id", length = 64)
    private String finishId;

    @Column(name = "size_spec", length = 64)
    private String sizeSpec;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "lens_options_snapshot", columnDefinition = "json")
    private List<OrderLensSnapshot> lensOptionsSnapshot = new ArrayList<>();

    @Column(name = "quoted_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal quotedAmount;

    @Column(name = "promised_delivery_date")
    private LocalDate promisedDeliveryDate;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "quote_note", length = 512)
    private String quoteNote;

    @Column(name = "change_summary", length = 512)
    private String changeSummary;

    @Column(name = "created_by", length = 120)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "confirmed_at")
    private LocalDateTime confirmedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = BusinessClock.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }
    public Integer getVersionNumber() { return versionNumber; }
    public void setVersionNumber(Integer versionNumber) { this.versionNumber = versionNumber; }
    public Long getProductId() { return productId; }
    public void setProductId(Long productId) { this.productId = productId; }
    public Long getSkuId() { return skuId; }
    public void setSkuId(Long skuId) { this.skuId = skuId; }
    public String getFinishId() { return finishId; }
    public void setFinishId(String finishId) { this.finishId = finishId; }
    public String getSizeSpec() { return sizeSpec; }
    public void setSizeSpec(String sizeSpec) { this.sizeSpec = sizeSpec; }
    public List<OrderLensSnapshot> getLensOptionsSnapshot() { return lensOptionsSnapshot; }
    public void setLensOptionsSnapshot(List<OrderLensSnapshot> lensOptionsSnapshot) { this.lensOptionsSnapshot = lensOptionsSnapshot; }
    public BigDecimal getQuotedAmount() { return quotedAmount; }
    public void setQuotedAmount(BigDecimal quotedAmount) { this.quotedAmount = quotedAmount; }
    public LocalDate getPromisedDeliveryDate() { return promisedDeliveryDate; }
    public void setPromisedDeliveryDate(LocalDate promisedDeliveryDate) { this.promisedDeliveryDate = promisedDeliveryDate; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
    public String getQuoteNote() { return quoteNote; }
    public void setQuoteNote(String quoteNote) { this.quoteNote = quoteNote; }
    public String getChangeSummary() { return changeSummary; }
    public void setChangeSummary(String changeSummary) { this.changeSummary = changeSummary; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(LocalDateTime confirmedAt) { this.confirmedAt = confirmedAt; }
}
