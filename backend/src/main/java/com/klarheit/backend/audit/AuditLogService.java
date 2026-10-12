package com.klarheit.backend.audit;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Records admin state-changing actions as immutable audit log entries.
 *
 * <p>Each call writes a new {@link AuditLog} row. Writes occur in a separate
 * transaction ({@link Propagation#REQUIRES_NEW}) so that an audit failure
 * does not roll back the business operation, and a business rollback does not
 * lose the audit trail. Logging failures are swallowed and logged at WARN —
 * audit logging must never break the user-facing operation.</p>
 */
@Slf4j
@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;

    public AuditLogService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Persist a single audit entry.
     *
     * @param adminEmail  email of the admin who triggered the action
     * @param action      verb describing the action (e.g. SHIP_ORDER)
     * @param targetType  entity type affected (e.g. ORDER, PRODUCT)
     * @param targetId    identifier of the affected entity
     * @param details     free-form additional context (nullable)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String adminEmail, String action, String targetType, String targetId, String details) {
        try {
            AuditLog entry = AuditLog.builder()
                    .adminEmail(adminEmail)
                    .action(action)
                    .targetType(targetType)
                    .targetId(targetId)
                    .details(details)
                    .build();
            auditLogRepository.save(entry);
        } catch (RuntimeException e) {
            // Audit logging must never break the business operation.
            log.warn("Failed to persist audit log entry: admin={}, action={}, target={}/{}",
                    adminEmail, action, targetType, targetId, e);
        }
    }
}
