package com.klarheit.backend.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class UserAccount {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(name = "first_name", nullable = false, length = 120)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 120)
    private String lastName;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;



    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public static Builder builder() {
        return new Builder();
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setId(Long id) { this.id = id; }
    public void setEmail(String email) { this.email = email; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public void setFirstName(String firstName) { this.firstName = firstName; }
    public void setLastName(String lastName) { this.lastName = lastName; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public static final class Builder {
        private final UserAccount instance = new UserAccount();
        public Builder id(Long id) { instance.id = id; return this; }
        public Builder email(String email) { instance.email = email; return this; }
        public Builder passwordHash(String passwordHash) { instance.passwordHash = passwordHash; return this; }
        public Builder firstName(String firstName) { instance.firstName = firstName; return this; }
        public Builder lastName(String lastName) { instance.lastName = lastName; return this; }
        public Builder createdAt(LocalDateTime createdAt) { instance.createdAt = createdAt; return this; }
        public UserAccount build() { return instance; }
    }
}
