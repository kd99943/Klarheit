package com.klarheit.backend.address;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "addresses")
public class Address {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "recipient_name", nullable = false, length = 120)
    private String recipientName;

    @Column(name = "phone_number", nullable = false, length = 20)
    private String phoneNumber;

    @Column(nullable = false, length = 100)
    private String province;

    @Column(nullable = false, length = 100)
    private String city;

    @Column(length = 100)
    private String district;

    @Column(name = "detail_address", nullable = false, length = 255)
    private String detailAddress;

    @Column(name = "is_default", nullable = false)
    private boolean isDefault = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public static Builder builder() {
        return new Builder();
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public String getRecipientName() { return recipientName; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getProvince() { return province; }
    public String getCity() { return city; }
    public String getDistrict() { return district; }
    public String getDetailAddress() { return detailAddress; }
    public boolean isDefault() { return isDefault; }
    public LocalDateTime getCreatedAt() { return createdAt; }

    public void setId(Long id) { this.id = id; }
    public void setUserId(Long userId) { this.userId = userId; }
    public void setRecipientName(String recipientName) { this.recipientName = recipientName; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public void setProvince(String province) { this.province = province; }
    public void setCity(String city) { this.city = city; }
    public void setDistrict(String district) { this.district = district; }
    public void setDetailAddress(String detailAddress) { this.detailAddress = detailAddress; }
    public void setDefault(boolean isDefault) { this.isDefault = isDefault; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public static final class Builder {
        private final Address instance = new Address();
        public Builder id(Long id) { instance.id = id; return this; }
        public Builder userId(Long userId) { instance.userId = userId; return this; }
        public Builder recipientName(String recipientName) { instance.recipientName = recipientName; return this; }
        public Builder phoneNumber(String phoneNumber) { instance.phoneNumber = phoneNumber; return this; }
        public Builder province(String province) { instance.province = province; return this; }
        public Builder city(String city) { instance.city = city; return this; }
        public Builder district(String district) { instance.district = district; return this; }
        public Builder detailAddress(String detailAddress) { instance.detailAddress = detailAddress; return this; }
        public Builder isDefault(boolean isDefault) { instance.isDefault = isDefault; return this; }
        public Address build() { return instance; }
    }
}
