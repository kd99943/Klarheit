package com.klarheit.backend.order;

import com.klarheit.backend.lens.LensOption;
import com.klarheit.backend.prescription.Prescription;
import com.klarheit.backend.product.Product;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "orders", indexes = {
    @Index(name = "idx_orders_order_number", columnList = "order_number", unique = true),
    @Index(name = "idx_orders_user_id", columnList = "user_id")
})
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "order_number", nullable = false, unique = true, length = 64)
    private String orderNumber;
    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;
    @Column(nullable = false, length = 32)
    private String status;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id")
    private Product product;
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prescription_id")
    private Prescription prescription;
    @Column(name = "customer_first_name", nullable = false, length = 120)
    private String customerFirstName;
    @Column(name = "customer_last_name", nullable = false, length = 120)
    private String customerLastName;
    @Column(name = "customer_email", nullable = false, length = 255)
    private String customerEmail;
    @Column(name = "customer_phone", length = 32)
    private String customerPhone;
    @Column(name = "shipping_address", nullable = false, length = 512)
    private String shippingAddress;
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "order_lens_options",
        joinColumns = @JoinColumn(name = "order_id"),
        inverseJoinColumns = @JoinColumn(name = "lens_option_id")
    )
    @BatchSize(size = 50)
    private List<LensOption> lensOptions = new ArrayList<>();
    @Column(name = "payment_channel", length = 32)
    private String paymentChannel;
    @Column(name = "gateway_transaction_id", length = 255)
    private String gatewayTransactionId;
    @Column(name = "discount_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;
    @Column(name = "applied_coupon_code", length = 64)
    private String appliedCouponCode;
    @Column(name = "coupon_released", nullable = false)
    private boolean couponReleased = false;
    @Column(name = "cancel_requested", nullable = false)
    private boolean cancelRequested = false;
    @Column(name = "refund_amount", precision = 10, scale = 2)
    private BigDecimal refundAmount;
    @Column(name = "refund_request_id", length = 128)
    private String refundRequestId;
    @Column(name = "refund_reason", length = 255)
    private String refundReason;
    @Column(name = "finish_id", length = 64)
    private String finishId;
    @Column(name = "product_name_snapshot", length = 120)
    private String productNameSnapshot;
    @Column(name = "product_image_url_snapshot", length = 1024)
    private String productImageUrlSnapshot;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "lens_options_snapshot", columnDefinition = "json")
    private List<OrderLensSnapshot> lensOptionsSnapshot = new ArrayList<>();
    @Column(name = "paid_at")
    private LocalDateTime paidAt;
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    @Column(name = "carrier", length = 100)
    private String carrier;
    @Column(name = "tracking_number", length = 100)
    private String trackingNumber;
    @Column(name = "idempotency_key", length = 128)
    private String idempotencyKey;
    @Column(name = "fulfillment_status", nullable = false, length = 32)
    private String fulfillmentStatus = FulfillmentStatus.PENDING_REVIEW;
    @Column(name = "fulfillment_note", length = 512)
    private String fulfillmentNote;
    @Column(name = "estimated_delivery_date")
    private LocalDate estimatedDeliveryDate;
    @Column(name = "delivered_at")
    private LocalDateTime deliveredAt;
    @Column(name = "stock_released", nullable = false)
    private boolean stockReleased = false;
    @Column(name = "wearer_name", length = 120)
    private String wearerName;
    @Column(name = "sku_id")
    private Long skuId;
    @Column(name = "size_spec_snapshot", length = 64)
    private String sizeSpecSnapshot;
    @Column(name = "sku_stock_committed", nullable = false)
    private boolean skuStockCommitted = false;
    @Column(name = "initial_promised_delivery_date")
    private LocalDate initialPromisedDeliveryDate;
    @Column(name = "delivery_delay_reason", length = 512)
    private String deliveryDelayReason;
    @Column(name = "requires_prepay_review", nullable = false)
    private boolean requiresPrepayReview = false;
    @Column(name = "prepay_review_reason", length = 512)
    private String prepayReviewReason;
    @Column(name = "quote_note", length = 512)
    private String quoteNote;
    @Column(name = "quote_revised_amount", precision = 10, scale = 2)
    private BigDecimal quoteRevisedAmount;
    @Column(name = "customer_quote_confirmed_at")
    private LocalDateTime customerQuoteConfirmedAt;
    @Column(name = "optician_verified_by", length = 120)
    private String opticianVerifiedBy;
    @Column(name = "optician_verified_at")
    private LocalDateTime opticianVerifiedAt;
    @Column(name = "qc_status", length = 32)
    private String qcStatus;
    @Column(name = "qc_note", length = 512)
    private String qcNote;
    @Column(name = "qc_checked_by", length = 120)
    private String qcCheckedBy;
    @Column(name = "qc_checked_at")
    private LocalDateTime qcCheckedAt;
    @Column(name = "order_source", length = 64)
    private String orderSource;
    @Column(name = "variable_cost_amount", precision = 10, scale = 2)
    private BigDecimal variableCostAmount;
    @Column(name = "parent_order_number", length = 64)
    private String parentOrderNumber;
    @Column(name = "quote_version", nullable = false)
    private Integer quoteVersion = 0;
    @Column(name = "quote_expires_at")
    private LocalDateTime quoteExpiresAt;
    @Column(name = "review_expires_at")
    private LocalDateTime reviewExpiresAt;
    @Column(name = "quote_change_summary", length = 512)
    private String quoteChangeSummary;
    @Column(name = "prescription_version", nullable = false)
    private Integer prescriptionVersion = 1;
    @Column(name = "optician_verified_rx_version")
    private Integer opticianVerifiedRxVersion;
    @Column(name = "first_shipped_at")
    private LocalDateTime firstShippedAt;
    @Column(name = "shipping_notified_tracking", length = 100)
    private String shippingNotifiedTracking;
    @Column(name = "shipping_province", length = 64)
    private String shippingProvince;
    @Column(name = "shipping_city", length = 64)
    private String shippingCity;
    @Column(name = "shipping_district", length = 64)
    private String shippingDistrict;
    @Column(name = "shipping_detail_address", length = 512)
    private String shippingDetailAddress;
    @Column(name = "shipping_fee", nullable = false, precision = 10, scale = 2)
    private BigDecimal shippingFee = BigDecimal.ZERO;
    @Column(name = "delivery_review_required", nullable = false)
    private boolean deliveryReviewRequired = false;
    @Column(name = "initial_promised_source", length = 32)
    private String initialPromisedSource;
    @Column(name = "confirmed_refund_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal confirmedRefundAmount = BigDecimal.ZERO;
    @Column(name = "pending_refund_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal pendingRefundAmount = BigDecimal.ZERO;
    @Column(name = "return_restocked", nullable = false)
    private boolean returnRestocked = false;
    @Column(name = "return_restocked_by_ticket", length = 64)
    private String returnRestockedByTicket;
    @Column(name = "return_restocked_at")
    private LocalDateTime returnRestockedAt;
    @Column(name = "shipping_cost_amount", precision = 10, scale = 2)
    private BigDecimal shippingCostAmount;
    @Column(name = "payment_fee_amount", precision = 10, scale = 2)
    private BigDecimal paymentFeeAmount;
    @Column(name = "expiry_reminder_sent_at")
    private LocalDateTime expiryReminderSentAt;

    public static Builder builder() { return new Builder(); }
    public Long getId() { return id; }
    public String getOrderNumber() { return orderNumber; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public String getStatus() { return status; }
    public Long getUserId() { return userId; }
    public Product getProduct() { return product; }
    public Prescription getPrescription() { return prescription; }
    public String getCustomerFirstName() { return customerFirstName; }
    public String getCustomerLastName() { return customerLastName; }
    public String getCustomerEmail() { return customerEmail; }
    public String getCustomerPhone() { return customerPhone; }
    public String getShippingAddress() { return shippingAddress; }
    public List<LensOption> getLensOptions() { return lensOptions; }
    public List<String> getLensOptionTypes() {
        if (lensOptionsSnapshot != null && !lensOptionsSnapshot.isEmpty()) {
            return lensOptionsSnapshot.stream().map(OrderLensSnapshot::type).toList();
        }
        if (lensOptions == null || !org.hibernate.Hibernate.isInitialized(lensOptions)) {
            return List.of();
        }
        return lensOptions.stream().map(LensOption::getType).toList();
    }
    public String getPaymentChannel() { return paymentChannel; }
    public String getGatewayTransactionId() { return gatewayTransactionId; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public String getAppliedCouponCode() { return appliedCouponCode; }
    public boolean isCouponReleased() { return couponReleased; }
    public boolean isCancelRequested() { return cancelRequested; }
    public BigDecimal getRefundAmount() { return refundAmount; }
    public String getRefundRequestId() { return refundRequestId; }
    public String getRefundReason() { return refundReason; }
    public String getFinishId() { return finishId; }
    public String getProductNameSnapshot() { return productNameSnapshot; }
    public String getProductImageUrlSnapshot() { return productImageUrlSnapshot; }
    public List<OrderLensSnapshot> getLensOptionsSnapshot() { return lensOptionsSnapshot; }
    public LocalDateTime getPaidAt() { return paidAt; }
    public String getCarrier() { return carrier; }
    public String getTrackingNumber() { return trackingNumber; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public String getFulfillmentStatus() { return fulfillmentStatus; }
    public String getFulfillmentNote() { return fulfillmentNote; }
    public LocalDate getEstimatedDeliveryDate() { return estimatedDeliveryDate; }
    public LocalDateTime getDeliveredAt() { return deliveredAt; }
    public boolean isStockReleased() { return stockReleased; }
    public String getWearerName() { return wearerName; }
    public Long getSkuId() { return skuId; }
    public String getSizeSpecSnapshot() { return sizeSpecSnapshot; }
    public boolean isSkuStockCommitted() { return skuStockCommitted; }
    public LocalDate getInitialPromisedDeliveryDate() { return initialPromisedDeliveryDate; }
    public String getDeliveryDelayReason() { return deliveryDelayReason; }
    public boolean isRequiresPrepayReview() { return requiresPrepayReview; }
    public String getPrepayReviewReason() { return prepayReviewReason; }
    public String getQuoteNote() { return quoteNote; }
    public BigDecimal getQuoteRevisedAmount() { return quoteRevisedAmount; }
    public LocalDateTime getCustomerQuoteConfirmedAt() { return customerQuoteConfirmedAt; }
    public String getOpticianVerifiedBy() { return opticianVerifiedBy; }
    public LocalDateTime getOpticianVerifiedAt() { return opticianVerifiedAt; }
    public String getQcStatus() { return qcStatus; }
    public String getQcNote() { return qcNote; }
    public String getQcCheckedBy() { return qcCheckedBy; }
    public LocalDateTime getQcCheckedAt() { return qcCheckedAt; }
    public String getOrderSource() { return orderSource; }
    public BigDecimal getVariableCostAmount() { return variableCostAmount; }
    public String getParentOrderNumber() { return parentOrderNumber; }
    public Integer getQuoteVersion() { return quoteVersion != null ? quoteVersion : 0; }
    public LocalDateTime getQuoteExpiresAt() { return quoteExpiresAt; }
    public LocalDateTime getReviewExpiresAt() { return reviewExpiresAt; }
    public String getQuoteChangeSummary() { return quoteChangeSummary; }
    public Integer getPrescriptionVersion() { return prescriptionVersion != null ? prescriptionVersion : 1; }
    public Integer getOpticianVerifiedRxVersion() { return opticianVerifiedRxVersion; }
    public LocalDateTime getFirstShippedAt() { return firstShippedAt; }
    public String getShippingNotifiedTracking() { return shippingNotifiedTracking; }
    public String getShippingProvince() { return shippingProvince; }
    public String getShippingCity() { return shippingCity; }
    public String getShippingDistrict() { return shippingDistrict; }
    public String getShippingDetailAddress() { return shippingDetailAddress; }
    public BigDecimal getShippingFee() { return shippingFee != null ? shippingFee : BigDecimal.ZERO; }
    public boolean isDeliveryReviewRequired() { return deliveryReviewRequired; }
    public String getInitialPromisedSource() { return initialPromisedSource; }
    public BigDecimal getConfirmedRefundAmount() { return confirmedRefundAmount != null ? confirmedRefundAmount : BigDecimal.ZERO; }
    public BigDecimal getPendingRefundAmount() { return pendingRefundAmount != null ? pendingRefundAmount : BigDecimal.ZERO; }
    public boolean isReturnRestocked() { return returnRestocked; }
    public String getReturnRestockedByTicket() { return returnRestockedByTicket; }
    public LocalDateTime getReturnRestockedAt() { return returnRestockedAt; }
    public BigDecimal getShippingCostAmount() { return shippingCostAmount; }
    public BigDecimal getPaymentFeeAmount() { return paymentFeeAmount; }
    public LocalDateTime getExpiryReminderSentAt() { return expiryReminderSentAt; }

    public void setId(Long id) { this.id = id; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public void setStatus(String status) { this.status = status; }
    public void setUserId(Long userId) { this.userId = userId; }
    public void setProduct(Product product) { this.product = product; }
    public void setPrescription(Prescription prescription) { this.prescription = prescription; }
    public void setCustomerFirstName(String customerFirstName) { this.customerFirstName = customerFirstName; }
    public void setCustomerLastName(String customerLastName) { this.customerLastName = customerLastName; }
    public void setCustomerEmail(String customerEmail) { this.customerEmail = customerEmail; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }
    public void setShippingAddress(String shippingAddress) { this.shippingAddress = shippingAddress; }
    public void setLensOptions(List<LensOption> lensOptions) { this.lensOptions = lensOptions; }
    public void setPaymentChannel(String paymentChannel) { this.paymentChannel = paymentChannel; }
    public void setGatewayTransactionId(String gatewayTransactionId) { this.gatewayTransactionId = gatewayTransactionId; }
    public void setDiscountAmount(BigDecimal discountAmount) { this.discountAmount = discountAmount; }
    public void setAppliedCouponCode(String appliedCouponCode) { this.appliedCouponCode = appliedCouponCode; }
    public void setCouponReleased(boolean couponReleased) { this.couponReleased = couponReleased; }
    public void setCancelRequested(boolean cancelRequested) { this.cancelRequested = cancelRequested; }
    public void setRefundAmount(BigDecimal refundAmount) { this.refundAmount = refundAmount; }
    public void setRefundRequestId(String refundRequestId) { this.refundRequestId = refundRequestId; }
    public void setRefundReason(String refundReason) { this.refundReason = refundReason; }
    public void setFinishId(String finishId) { this.finishId = finishId; }
    public void setPaidAt(LocalDateTime paidAt) { this.paidAt = paidAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public void setCarrier(String carrier) { this.carrier = carrier; }
    public void setTrackingNumber(String trackingNumber) { this.trackingNumber = trackingNumber; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public void setFulfillmentStatus(String fulfillmentStatus) { this.fulfillmentStatus = fulfillmentStatus; }
    public void setFulfillmentNote(String fulfillmentNote) { this.fulfillmentNote = fulfillmentNote; }
    public void setEstimatedDeliveryDate(LocalDate estimatedDeliveryDate) { this.estimatedDeliveryDate = estimatedDeliveryDate; }
    public void setDeliveredAt(LocalDateTime deliveredAt) { this.deliveredAt = deliveredAt; }
    public void setStockReleased(boolean stockReleased) { this.stockReleased = stockReleased; }
    public void setWearerName(String wearerName) { this.wearerName = wearerName; }
    public void setSkuId(Long skuId) { this.skuId = skuId; }
    public void setSizeSpecSnapshot(String sizeSpecSnapshot) { this.sizeSpecSnapshot = sizeSpecSnapshot; }
    public void setSkuStockCommitted(boolean skuStockCommitted) { this.skuStockCommitted = skuStockCommitted; }
    public void setInitialPromisedDeliveryDate(LocalDate initialPromisedDeliveryDate) { this.initialPromisedDeliveryDate = initialPromisedDeliveryDate; }
    public void setDeliveryDelayReason(String deliveryDelayReason) { this.deliveryDelayReason = deliveryDelayReason; }
    public void setRequiresPrepayReview(boolean requiresPrepayReview) { this.requiresPrepayReview = requiresPrepayReview; }
    public void setPrepayReviewReason(String prepayReviewReason) { this.prepayReviewReason = prepayReviewReason; }
    public void setQuoteNote(String quoteNote) { this.quoteNote = quoteNote; }
    public void setQuoteRevisedAmount(BigDecimal quoteRevisedAmount) { this.quoteRevisedAmount = quoteRevisedAmount; }
    public void setCustomerQuoteConfirmedAt(LocalDateTime customerQuoteConfirmedAt) { this.customerQuoteConfirmedAt = customerQuoteConfirmedAt; }
    public void setOpticianVerifiedBy(String opticianVerifiedBy) { this.opticianVerifiedBy = opticianVerifiedBy; }
    public void setOpticianVerifiedAt(LocalDateTime opticianVerifiedAt) { this.opticianVerifiedAt = opticianVerifiedAt; }
    public void setQcStatus(String qcStatus) { this.qcStatus = qcStatus; }
    public void setQcNote(String qcNote) { this.qcNote = qcNote; }
    public void setQcCheckedBy(String qcCheckedBy) { this.qcCheckedBy = qcCheckedBy; }
    public void setQcCheckedAt(LocalDateTime qcCheckedAt) { this.qcCheckedAt = qcCheckedAt; }
    public void setOrderSource(String orderSource) { this.orderSource = orderSource; }
    public void setVariableCostAmount(BigDecimal variableCostAmount) { this.variableCostAmount = variableCostAmount; }
    public void setParentOrderNumber(String parentOrderNumber) { this.parentOrderNumber = parentOrderNumber; }
    public void setLensOptionsSnapshot(List<OrderLensSnapshot> lensOptionsSnapshot) { this.lensOptionsSnapshot = lensOptionsSnapshot; }
    public void setQuoteVersion(Integer quoteVersion) { this.quoteVersion = quoteVersion; }
    public void setQuoteExpiresAt(LocalDateTime quoteExpiresAt) { this.quoteExpiresAt = quoteExpiresAt; }
    public void setReviewExpiresAt(LocalDateTime reviewExpiresAt) { this.reviewExpiresAt = reviewExpiresAt; }
    public void setQuoteChangeSummary(String quoteChangeSummary) { this.quoteChangeSummary = quoteChangeSummary; }
    public void setPrescriptionVersion(Integer prescriptionVersion) { this.prescriptionVersion = prescriptionVersion; }
    public void setOpticianVerifiedRxVersion(Integer opticianVerifiedRxVersion) { this.opticianVerifiedRxVersion = opticianVerifiedRxVersion; }
    public void setFirstShippedAt(LocalDateTime firstShippedAt) { this.firstShippedAt = firstShippedAt; }
    public void setShippingNotifiedTracking(String shippingNotifiedTracking) { this.shippingNotifiedTracking = shippingNotifiedTracking; }
    public void setShippingProvince(String shippingProvince) { this.shippingProvince = shippingProvince; }
    public void setShippingCity(String shippingCity) { this.shippingCity = shippingCity; }
    public void setShippingDistrict(String shippingDistrict) { this.shippingDistrict = shippingDistrict; }
    public void setShippingDetailAddress(String shippingDetailAddress) { this.shippingDetailAddress = shippingDetailAddress; }
    public void setShippingFee(BigDecimal shippingFee) { this.shippingFee = shippingFee != null ? shippingFee : BigDecimal.ZERO; }
    public void setDeliveryReviewRequired(boolean deliveryReviewRequired) { this.deliveryReviewRequired = deliveryReviewRequired; }
    public void setInitialPromisedSource(String initialPromisedSource) { this.initialPromisedSource = initialPromisedSource; }
    public void setConfirmedRefundAmount(BigDecimal confirmedRefundAmount) { this.confirmedRefundAmount = confirmedRefundAmount != null ? confirmedRefundAmount : BigDecimal.ZERO; }
    public void setPendingRefundAmount(BigDecimal pendingRefundAmount) { this.pendingRefundAmount = pendingRefundAmount != null ? pendingRefundAmount : BigDecimal.ZERO; }
    public void setReturnRestocked(boolean returnRestocked) { this.returnRestocked = returnRestocked; }
    public void setReturnRestockedByTicket(String returnRestockedByTicket) { this.returnRestockedByTicket = returnRestockedByTicket; }
    public void setReturnRestockedAt(LocalDateTime returnRestockedAt) { this.returnRestockedAt = returnRestockedAt; }
    public void setShippingCostAmount(BigDecimal shippingCostAmount) { this.shippingCostAmount = shippingCostAmount; }
    public void setPaymentFeeAmount(BigDecimal paymentFeeAmount) { this.paymentFeeAmount = paymentFeeAmount; }
    public void setExpiryReminderSentAt(LocalDateTime expiryReminderSentAt) { this.expiryReminderSentAt = expiryReminderSentAt; }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = BusinessClock.now();
        }
        if (fulfillmentStatus == null || fulfillmentStatus.isBlank()) {
            fulfillmentStatus = FulfillmentStatus.PENDING_REVIEW;
        }
        if (quoteVersion == null) quoteVersion = 0;
        if (prescriptionVersion == null) prescriptionVersion = 1;
        if (shippingFee == null) shippingFee = BigDecimal.ZERO;
        if (confirmedRefundAmount == null) confirmedRefundAmount = BigDecimal.ZERO;
        if (pendingRefundAmount == null) pendingRefundAmount = BigDecimal.ZERO;
    }

    public static final class Builder {
        private final Order instance = new Order();
        public Builder id(Long id) { instance.id = id; return this; }
        public Builder orderNumber(String orderNumber) { instance.orderNumber = orderNumber; return this; }
        public Builder totalAmount(BigDecimal totalAmount) { instance.totalAmount = totalAmount; return this; }
        public Builder status(String status) { instance.status = status; return this; }
        public Builder userId(Long userId) { instance.userId = userId; return this; }
        public Builder product(Product product) { instance.product = product; return this; }
        public Builder prescription(Prescription prescription) { instance.prescription = prescription; return this; }
        public Builder customerFirstName(String customerFirstName) { instance.customerFirstName = customerFirstName; return this; }
        public Builder customerLastName(String customerLastName) { instance.customerLastName = customerLastName; return this; }
        public Builder customerEmail(String customerEmail) { instance.customerEmail = customerEmail; return this; }
        public Builder customerPhone(String customerPhone) { instance.customerPhone = customerPhone; return this; }
        public Builder shippingAddress(String shippingAddress) { instance.shippingAddress = shippingAddress; return this; }
        public Builder lensOptions(List<LensOption> lensOptions) { instance.lensOptions = lensOptions; return this; }
        public Builder paymentChannel(String paymentChannel) { instance.paymentChannel = paymentChannel; return this; }
        public Builder gatewayTransactionId(String gatewayTransactionId) { instance.gatewayTransactionId = gatewayTransactionId; return this; }
        public Builder discountAmount(BigDecimal discountAmount) { instance.discountAmount = discountAmount; return this; }
        public Builder appliedCouponCode(String appliedCouponCode) { instance.appliedCouponCode = appliedCouponCode; return this; }
        public Builder couponReleased(boolean couponReleased) { instance.couponReleased = couponReleased; return this; }
        public Builder cancelRequested(boolean cancelRequested) { instance.cancelRequested = cancelRequested; return this; }
        public Builder refundAmount(BigDecimal refundAmount) { instance.refundAmount = refundAmount; return this; }
        public Builder refundRequestId(String refundRequestId) { instance.refundRequestId = refundRequestId; return this; }
        public Builder refundReason(String refundReason) { instance.refundReason = refundReason; return this; }
        public Builder finishId(String finishId) { instance.finishId = finishId; return this; }
        public Builder productNameSnapshot(String productNameSnapshot) { instance.productNameSnapshot = productNameSnapshot; return this; }
        public Builder productImageUrlSnapshot(String productImageUrlSnapshot) { instance.productImageUrlSnapshot = productImageUrlSnapshot; return this; }
        public Builder lensOptionsSnapshot(List<OrderLensSnapshot> lensOptionsSnapshot) { instance.lensOptionsSnapshot = lensOptionsSnapshot; return this; }
        public Builder paidAt(LocalDateTime paidAt) { instance.paidAt = paidAt; return this; }
        public Builder createdAt(LocalDateTime createdAt) { instance.createdAt = createdAt; return this; }
        public Builder carrier(String carrier) { instance.carrier = carrier; return this; }
        public Builder trackingNumber(String trackingNumber) { instance.trackingNumber = trackingNumber; return this; }
        public Builder idempotencyKey(String idempotencyKey) { instance.idempotencyKey = idempotencyKey; return this; }
        public Builder fulfillmentStatus(String fulfillmentStatus) { instance.fulfillmentStatus = fulfillmentStatus; return this; }
        public Builder fulfillmentNote(String fulfillmentNote) { instance.fulfillmentNote = fulfillmentNote; return this; }
        public Builder estimatedDeliveryDate(LocalDate estimatedDeliveryDate) { instance.estimatedDeliveryDate = estimatedDeliveryDate; return this; }
        public Builder deliveredAt(LocalDateTime deliveredAt) { instance.deliveredAt = deliveredAt; return this; }
        public Builder stockReleased(boolean stockReleased) { instance.stockReleased = stockReleased; return this; }
        public Builder wearerName(String wearerName) { instance.wearerName = wearerName; return this; }
        public Builder skuId(Long skuId) { instance.skuId = skuId; return this; }
        public Builder sizeSpecSnapshot(String sizeSpecSnapshot) { instance.sizeSpecSnapshot = sizeSpecSnapshot; return this; }
        public Builder skuStockCommitted(boolean skuStockCommitted) { instance.skuStockCommitted = skuStockCommitted; return this; }
        public Builder initialPromisedDeliveryDate(LocalDate initialPromisedDeliveryDate) { instance.initialPromisedDeliveryDate = initialPromisedDeliveryDate; return this; }
        public Builder deliveryDelayReason(String deliveryDelayReason) { instance.deliveryDelayReason = deliveryDelayReason; return this; }
        public Builder requiresPrepayReview(boolean requiresPrepayReview) { instance.requiresPrepayReview = requiresPrepayReview; return this; }
        public Builder prepayReviewReason(String prepayReviewReason) { instance.prepayReviewReason = prepayReviewReason; return this; }
        public Builder quoteNote(String quoteNote) { instance.quoteNote = quoteNote; return this; }
        public Builder quoteRevisedAmount(BigDecimal quoteRevisedAmount) { instance.quoteRevisedAmount = quoteRevisedAmount; return this; }
        public Builder customerQuoteConfirmedAt(LocalDateTime customerQuoteConfirmedAt) { instance.customerQuoteConfirmedAt = customerQuoteConfirmedAt; return this; }
        public Builder opticianVerifiedBy(String opticianVerifiedBy) { instance.opticianVerifiedBy = opticianVerifiedBy; return this; }
        public Builder opticianVerifiedAt(LocalDateTime opticianVerifiedAt) { instance.opticianVerifiedAt = opticianVerifiedAt; return this; }
        public Builder qcStatus(String qcStatus) { instance.qcStatus = qcStatus; return this; }
        public Builder qcNote(String qcNote) { instance.qcNote = qcNote; return this; }
        public Builder qcCheckedBy(String qcCheckedBy) { instance.qcCheckedBy = qcCheckedBy; return this; }
        public Builder qcCheckedAt(LocalDateTime qcCheckedAt) { instance.qcCheckedAt = qcCheckedAt; return this; }
        public Builder orderSource(String orderSource) { instance.orderSource = orderSource; return this; }
        public Builder variableCostAmount(BigDecimal variableCostAmount) { instance.variableCostAmount = variableCostAmount; return this; }
        public Builder parentOrderNumber(String parentOrderNumber) { instance.parentOrderNumber = parentOrderNumber; return this; }
        public Builder quoteVersion(Integer quoteVersion) { instance.quoteVersion = quoteVersion; return this; }
        public Builder quoteExpiresAt(LocalDateTime quoteExpiresAt) { instance.quoteExpiresAt = quoteExpiresAt; return this; }
        public Builder reviewExpiresAt(LocalDateTime reviewExpiresAt) { instance.reviewExpiresAt = reviewExpiresAt; return this; }
        public Builder quoteChangeSummary(String quoteChangeSummary) { instance.quoteChangeSummary = quoteChangeSummary; return this; }
        public Builder prescriptionVersion(Integer prescriptionVersion) { instance.prescriptionVersion = prescriptionVersion; return this; }
        public Builder opticianVerifiedRxVersion(Integer opticianVerifiedRxVersion) { instance.opticianVerifiedRxVersion = opticianVerifiedRxVersion; return this; }
        public Builder firstShippedAt(LocalDateTime firstShippedAt) { instance.firstShippedAt = firstShippedAt; return this; }
        public Builder shippingNotifiedTracking(String shippingNotifiedTracking) { instance.shippingNotifiedTracking = shippingNotifiedTracking; return this; }
        public Builder shippingProvince(String shippingProvince) { instance.shippingProvince = shippingProvince; return this; }
        public Builder shippingCity(String shippingCity) { instance.shippingCity = shippingCity; return this; }
        public Builder shippingDistrict(String shippingDistrict) { instance.shippingDistrict = shippingDistrict; return this; }
        public Builder shippingDetailAddress(String shippingDetailAddress) { instance.shippingDetailAddress = shippingDetailAddress; return this; }
        public Builder shippingFee(BigDecimal shippingFee) { instance.shippingFee = shippingFee != null ? shippingFee : BigDecimal.ZERO; return this; }
        public Builder deliveryReviewRequired(boolean deliveryReviewRequired) { instance.deliveryReviewRequired = deliveryReviewRequired; return this; }
        public Builder initialPromisedSource(String initialPromisedSource) { instance.initialPromisedSource = initialPromisedSource; return this; }
        public Builder confirmedRefundAmount(BigDecimal confirmedRefundAmount) { instance.confirmedRefundAmount = confirmedRefundAmount != null ? confirmedRefundAmount : BigDecimal.ZERO; return this; }
        public Builder pendingRefundAmount(BigDecimal pendingRefundAmount) { instance.pendingRefundAmount = pendingRefundAmount != null ? pendingRefundAmount : BigDecimal.ZERO; return this; }
        public Builder returnRestocked(boolean returnRestocked) { instance.returnRestocked = returnRestocked; return this; }
        public Builder returnRestockedByTicket(String returnRestockedByTicket) { instance.returnRestockedByTicket = returnRestockedByTicket; return this; }
        public Builder returnRestockedAt(LocalDateTime returnRestockedAt) { instance.returnRestockedAt = returnRestockedAt; return this; }
        public Builder shippingCostAmount(BigDecimal shippingCostAmount) { instance.shippingCostAmount = shippingCostAmount; return this; }
        public Builder paymentFeeAmount(BigDecimal paymentFeeAmount) { instance.paymentFeeAmount = paymentFeeAmount; return this; }
        public Order build() { return instance; }
    }
}
