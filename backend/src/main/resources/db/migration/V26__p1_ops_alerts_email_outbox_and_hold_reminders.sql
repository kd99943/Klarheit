-- V26__p1_ops_alerts_email_outbox_and_hold_reminders.sql
-- Adds:
-- 1. P0-02: orders.expiry_reminder_sent_at for proactive hold-expiry reminder deduplication
-- 2. Sec 6 P1: email_notification_logs table for durable failed-email tracking & idempotent event-key resend
-- 3. Sec 6 P1: Composite indexes for period-scoped financial reconciliation & operational alert queries

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 1. Email delivery log / failure outbox with unique event_key for idempotent resend
CREATE TABLE IF NOT EXISTS email_notification_logs (
    id                 BIGINT        AUTO_INCREMENT PRIMARY KEY,
    event_key          VARCHAR(191)  NOT NULL,
    event_type         VARCHAR(64)   NOT NULL,
    order_number       VARCHAR(64)   NULL,
    recipient_email    VARCHAR(255)  NOT NULL,
    subject            VARCHAR(255)  NOT NULL,
    body_html          TEXT          NOT NULL,
    status             VARCHAR(32)   NOT NULL DEFAULT 'PENDING',
    attempt_count      INT           NOT NULL DEFAULT 0,
    last_error         VARCHAR(1000) NULL,
    created_at         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_attempted_at  DATETIME      NULL,
    sent_at            DATETIME      NULL,
    resent_by          VARCHAR(120)  NULL,
    UNIQUE KEY uk_email_notification_event_key (event_key),
    INDEX idx_email_notification_status_created (status, created_at),
    INDEX idx_email_notification_order (order_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Idempotent helper procedure to add missing columns / indexes cleanly on MySQL 8.x
DROP PROCEDURE IF EXISTS klarheit_v26_add_column_if_missing;
DELIMITER $$
CREATE PROCEDURE klarheit_v26_add_column_if_missing(
    IN p_table VARCHAR(64),
    IN p_column VARCHAR(64),
    IN p_definition TEXT
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = p_table
          AND COLUMN_NAME = p_column
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_column, ' ', p_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

DROP PROCEDURE IF EXISTS klarheit_v26_add_index_if_missing;
DELIMITER $$
CREATE PROCEDURE klarheit_v26_add_index_if_missing(
    IN p_table VARCHAR(64),
    IN p_index VARCHAR(64),
    IN p_columns VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = p_table
          AND INDEX_NAME = p_index
    ) THEN
        SET @ddl = CONCAT('CREATE INDEX ', p_index, ' ON ', p_table, ' (', p_columns, ')');
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$
DELIMITER ;

-- P0-02 hold expiry reminder deduplication timestamp
CALL klarheit_v26_add_column_if_missing('orders', 'expiry_reminder_sent_at', 'DATETIME NULL');

-- Sec 6 P1 performance indexes for period-scoped reconciliation & alerts
CALL klarheit_v26_add_index_if_missing('orders', 'idx_orders_paid_at', 'paid_at');
CALL klarheit_v26_add_index_if_missing('orders', 'idx_orders_status_created', 'status, created_at');
CALL klarheit_v26_add_index_if_missing('refund_transactions', 'idx_refund_tx_status_confirmed', 'status, confirmed_at');
CALL klarheit_v26_add_index_if_missing('after_sales_tickets', 'idx_after_sales_status_updated', 'status, updated_at');

DROP PROCEDURE IF EXISTS klarheit_v26_add_column_if_missing;
DROP PROCEDURE IF EXISTS klarheit_v26_add_index_if_missing;
