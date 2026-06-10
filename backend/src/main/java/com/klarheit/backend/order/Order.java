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
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

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
    @Column(name = "shipping_address", nullable = false, length = 512)
    private String shippingAddress;
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "order_lens_options",
        joinColumns = @JoinColumn(name = "order_id"),
        inverseJoinColumns = @JoinColumn(name = "lens_option_id")
    )
    private List<LensOption> lensOptions = new ArrayList<>();
    @Column(name = "payment_channel", length = 32)
    private String paymentChannel;
    @Column(name = "gateway_transaction_id", length = 255)
    private String gatewayTransactionId;
    @Column(name = "discount_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountAmount = BigDecimal.ZERO;
    @Column(name = "applied_coupon_code", length = 64)
    private String appliedCouponCode;
    @Column(name = "finish_id", length = 64)
    private String finishId;
    @Column(name = "paid_at")
    private LocalDateTime paidAt;
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

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
    public String getShippingAddress() { return shippingAddress; }
    public List<LensOption> getLensOptions() { return lensOptions; }
    public List<String> getLensOptionTypes() {
        return lensOptions.stream().map(LensOption::getType).toList();
    }
    public String getPaymentChannel() { return paymentChannel; }
    public String getGatewayTransactionId() { return gatewayTransactionId; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public String getAppliedCouponCode() { return appliedCouponCode; }
    public String getFinishId() { return finishId; }
    public LocalDateTime getPaidAt() { return paidAt; }

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
    public void setShippingAddress(String shippingAddress) { this.shippingAddress = shippingAddress; }
    public void setLensOptions(List<LensOption> lensOptions) { this.lensOptions = lensOptions; }
    public void setPaymentChannel(String paymentChannel) { this.paymentChannel = paymentChannel; }
    public void setGatewayTransactionId(String gatewayTransactionId) { this.gatewayTransactionId = gatewayTransactionId; }
    public void setDiscountAmount(BigDecimal discountAmount) { this.discountAmount = discountAmount; }
    public void setAppliedCouponCode(String appliedCouponCode) { this.appliedCouponCode = appliedCouponCode; }
    public void setFinishId(String finishId) { this.finishId = finishId; }
    public void setPaidAt(LocalDateTime paidAt) { this.paidAt = paidAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
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
        public Builder shippingAddress(String shippingAddress) { instance.shippingAddress = shippingAddress; return this; }
        public Builder lensOptions(List<LensOption> lensOptions) { instance.lensOptions = lensOptions; return this; }
        public Builder paymentChannel(String paymentChannel) { instance.paymentChannel = paymentChannel; return this; }
        public Builder gatewayTransactionId(String gatewayTransactionId) { instance.gatewayTransactionId = gatewayTransactionId; return this; }
        public Builder discountAmount(BigDecimal discountAmount) { instance.discountAmount = discountAmount; return this; }
        public Builder appliedCouponCode(String appliedCouponCode) { instance.appliedCouponCode = appliedCouponCode; return this; }
        public Builder finishId(String finishId) { instance.finishId = finishId; return this; }
        public Builder paidAt(LocalDateTime paidAt) { instance.paidAt = paidAt; return this; }
        public Builder createdAt(LocalDateTime createdAt) { instance.createdAt = createdAt; return this; }
        public Order build() { return instance; }
    }
}
