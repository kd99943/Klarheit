-- V20__order_refund_persistence_fields.sql
-- Persist actual refund amount, refund request identifier, refund reason,
-- and admin cancellation intent (cancel_requested) for deferred reconciliation.
DROP PROCEDURE IF EXISTS EnsureV20RefundColumns;
DELIMITER //
CREATE PROCEDURE EnsureV20RefundColumns()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'orders'
          AND column_name = 'refund_amount'
    ) THEN
        ALTER TABLE orders
            ADD COLUMN refund_amount DECIMAL(10, 2) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'orders'
          AND column_name = 'refund_request_id'
    ) THEN
        ALTER TABLE orders
            ADD COLUMN refund_request_id VARCHAR(128) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'orders'
          AND column_name = 'refund_reason'
    ) THEN
        ALTER TABLE orders
            ADD COLUMN refund_reason VARCHAR(255) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'orders'
          AND column_name = 'cancel_requested'
    ) THEN
        ALTER TABLE orders
            ADD COLUMN cancel_requested TINYINT(1) NOT NULL DEFAULT 0;
    END IF;
END //
DELIMITER ;
CALL EnsureV20RefundColumns();
DROP PROCEDURE EnsureV20RefundColumns;
