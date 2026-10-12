-- V18__create_audit_logs_table.sql
-- Creates the audit_logs table for capturing admin state-changing actions.
--
-- Each row is an immutable record of who did what to which entity at when.
-- Rows are append-only: application code never UPDATEs or DELETEs them.
-- Indexes cover the three common query patterns:
--   * time-ordered browsing (idx_audit_logs_timestamp)
--   * "what did this admin do" (idx_audit_logs_admin_email)
--   * "who touched this order/product" (idx_audit_logs_target)

CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    timestamp   DATETIME     NOT NULL,
    admin_email VARCHAR(255) NOT NULL,
    action      VARCHAR(64)  NOT NULL,
    target_type VARCHAR(32)  NOT NULL,
    target_id   VARCHAR(128) NOT NULL,
    details     VARCHAR(2048) NULL,
    PRIMARY KEY (id),
    INDEX idx_audit_logs_timestamp (timestamp),
    INDEX idx_audit_logs_admin_email (admin_email),
    INDEX idx_audit_logs_target (target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
