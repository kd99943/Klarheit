package com.klarheit.backend.order;

import com.klarheit.backend.auth.UserAccount;
import com.klarheit.backend.prescription.Prescription;
import com.klarheit.backend.product.Product;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "orders")
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
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private UserAccount user;
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
    @Column(name = "lens_option_types", nullable = false, length = 512)
    private String lensOptionTypes;

    public static Builder builder() { return new Builder(); }
    public Long getId() { return id; }
    public String getOrderNumber() { return orderNumber; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public String getStatus() { return status; }
    public UserAccount getUser() { return user; }
    public Product getProduct() { return product; }
    public Prescription getPrescription() { return prescription; }
    public String getCustomerFirstName() { return customerFirstName; }
    public String getCustomerLastName() { return customerLastName; }
    public String getCustomerEmail() { return customerEmail; }
    public String getShippingAddress() { return shippingAddress; }
    public String getLensOptionTypes() { return lensOptionTypes; }
    public void setId(Long id) { this.id = id; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public void setStatus(String status) { this.status = status; }
    public void setUser(UserAccount user) { this.user = user; }
    public void setProduct(Product product) { this.product = product; }
    public void setPrescription(Prescription prescription) { this.prescription = prescription; }
    public void setCustomerFirstName(String customerFirstName) { this.customerFirstName = customerFirstName; }
    public void setCustomerLastName(String customerLastName) { this.customerLastName = customerLastName; }
    public void setCustomerEmail(String customerEmail) { this.customerEmail = customerEmail; }
    public void setShippingAddress(String shippingAddress) { this.shippingAddress = shippingAddress; }
    public void setLensOptionTypes(String lensOptionTypes) { this.lensOptionTypes = lensOptionTypes; }

    public static final class Builder {
        private final Order instance = new Order();
        public Builder id(Long id) { instance.id = id; return this; }
        public Builder orderNumber(String orderNumber) { instance.orderNumber = orderNumber; return this; }
        public Builder totalAmount(BigDecimal totalAmount) { instance.totalAmount = totalAmount; return this; }
        public Builder status(String status) { instance.status = status; return this; }
        public Builder user(UserAccount user) { instance.user = user; return this; }
        public Builder product(Product product) { instance.product = product; return this; }
        public Builder prescription(Prescription prescription) { instance.prescription = prescription; return this; }
        public Builder customerFirstName(String customerFirstName) { instance.customerFirstName = customerFirstName; return this; }
        public Builder customerLastName(String customerLastName) { instance.customerLastName = customerLastName; return this; }
        public Builder customerEmail(String customerEmail) { instance.customerEmail = customerEmail; return this; }
        public Builder shippingAddress(String shippingAddress) { instance.shippingAddress = shippingAddress; return this; }
        public Builder lensOptionTypes(String lensOptionTypes) { instance.lensOptionTypes = lensOptionTypes; return this; }
        public Order build() { return instance; }
    }
}
