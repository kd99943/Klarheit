-- V19__order_recipient_phone_and_reconciliation_fields.sql
-- 1. Ensure uk_ar_configs_product_finish exists idempotently via a new versioned migration
--    instead of mutating historical V11.
DROP PROCEDURE IF EXISTS EnsureV19SchemaUpdates;
DELIMITER //
CREATE PROCEDURE EnsureV19SchemaUpdates()
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.statistics
        WHERE table_schema = DATABASE()
          AND table_name = 'product_ar_configs'
          AND index_name = 'uk_ar_configs_product_finish'
    ) THEN
        ALTER TABLE product_ar_configs
            ADD CONSTRAINT uk_ar_configs_product_finish UNIQUE (product_id, finish_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'orders'
          AND column_name = 'customer_phone'
    ) THEN
        ALTER TABLE orders
            ADD COLUMN customer_phone VARCHAR(32) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
          AND table_name = 'orders'
          AND column_name = 'coupon_released'
    ) THEN
        ALTER TABLE orders
            ADD COLUMN coupon_released BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END //
DELIMITER ;
CALL EnsureV19SchemaUpdates();
DROP PROCEDURE EnsureV19SchemaUpdates;
