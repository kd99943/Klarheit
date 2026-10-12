package com.klarheit.backend.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Immutable record of a state-changing admin action.
 *
 * <p>Each row captures <em>who</em> did <em>what</em> to <em>which entity</em>
 * at <em>when</em>, plus a free-form details string for additional context.
 * Read-only after insert — audit entries are never updated or deleted by
 * application code.</p>
 */
@Entity
@Table(name = "audit_logs", indexes = {
    @Index(name = "idx_audit_logs_timestamp", columnList = "timestamp"),
    @Index(name = "idx_audit_logs_admin_email", columnList = "admin_email"),
    @Index(name = "idx_audit_logs_target", columnList = "target_type, target_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "timestamp", nullable = false)
    private LocalDateTime timestamp;

    /** Email of the admin user who performed the action. */
    @Column(name = "admin_email", nullable = false, length = 255)
    private String adminEmail;

    /** Action verb, e.g. SHIP_ORDER, CANCEL_ORDER, CREATE_PRODUCT, UPDATE_PRODUCT, DELETE_PRODUCT. */
    @Column(nullable = false, length = 64)
    private String action;

    /** Entity type affected, e.g. ORDER, PRODUCT. */
    @Column(name = "target_type", nullable = false, length = 32)
    private String targetType;

    /** Identifier of the affected entity (order number for orders, id for products). */
    @Column(name = "target_id", nullable = false, length = 128)
    private String targetId;

    /** Free-form additional context (JSON or human-readable). Nullable. */
    @Column(length = 2048)
    private String details;

    @PrePersist
    void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }
}
