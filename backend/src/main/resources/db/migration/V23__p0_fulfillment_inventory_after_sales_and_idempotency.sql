-- V23__p0_fulfillment_inventory_after_sales_and_idempotency.sql
-- Adds P0 operational capabilities:
-- 1. Product inventory (stock_quantity) and availability status (sales_status)
-- 2. Additional refractive index lens options matching catalog/FAQ (1.56, 1.61, 1.67)
-- 3. Order fulfillment lifecycle, idempotency key, stock release tracking, wearer name, delivery date
-- 4. Prescription saved-to-profile flag, wearer name, source note, timestamp
-- 5. After-sales support tickets table
-- 6. System settings table (checkout kill switch)

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS EnsureV23SchemaUpdates;
DELIMITER //
CREATE PROCEDURE EnsureV23SchemaUpdates()
BEGIN
    -- 1. Products: stock_quantity & sales_status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'stock_quantity'
    ) THEN
        ALTER TABLE products ADD COLUMN stock_quantity INT NOT NULL DEFAULT 50;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'sales_status'
    ) THEN
        ALTER TABLE products ADD COLUMN sales_status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE';
    END IF;

    -- 2. Orders: idempotency, fulfillment tracking, stock release, wearer name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE orders ADD COLUMN idempotency_key VARCHAR(128) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.statistics
        WHERE table_schema = DATABASE() AND table_name = 'orders' AND index_name = 'uk_orders_user_idempotency'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT uk_orders_user_idempotency UNIQUE (user_id, idempotency_key);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'fulfillment_status'
    ) THEN
        ALTER TABLE orders ADD COLUMN fulfillment_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'fulfillment_note'
    ) THEN
        ALTER TABLE orders ADD COLUMN fulfillment_note VARCHAR(512) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'estimated_delivery_date'
    ) THEN
        ALTER TABLE orders ADD COLUMN estimated_delivery_date DATE NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivered_at'
    ) THEN
        ALTER TABLE orders ADD COLUMN delivered_at DATETIME NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'stock_released'
    ) THEN
        ALTER TABLE orders ADD COLUMN stock_released BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'wearer_name'
    ) THEN
        ALTER TABLE orders ADD COLUMN wearer_name VARCHAR(120) NULL;
    END IF;

    -- 3. Prescriptions: saved_to_profile, wearer_name, source_note, created_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'prescriptions' AND column_name = 'saved_to_profile'
    ) THEN
        ALTER TABLE prescriptions ADD COLUMN saved_to_profile BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'prescriptions' AND column_name = 'wearer_name'
    ) THEN
        ALTER TABLE prescriptions ADD COLUMN wearer_name VARCHAR(120) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'prescriptions' AND column_name = 'source_note'
    ) THEN
        ALTER TABLE prescriptions ADD COLUMN source_note VARCHAR(120) NULL;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = 'prescriptions' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE prescriptions ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
END //
DELIMITER ;
CALL EnsureV23SchemaUpdates();
DROP PROCEDURE EnsureV23SchemaUpdates;

-- 4. Seed standard optical refractive index options matching catalog & FAQ
INSERT IGNORE INTO lens_options (type, index_value, additional_price, category, label, description)
VALUES
    ('STANDARD_156',  1.56,   0.00, 'LENS', 'Standard Index Lenses (1.56)',   'Included optical resin lenses suitable for light prescriptions (up to ±3.00).'),
    ('THIN_161',      1.61, 100.00, 'LENS', 'Thin Index Lenses (1.61)',       'Thinner and lighter 1.61 lenses recommended for ±3.00 to ±5.00.'),
    ('ULTRATHIN_167', 1.67, 160.00, 'LENS', 'Ultra-Thin Index Lenses (1.67)', 'High-index 1.67 lenses recommended for ±5.00 to ±7.00.');

-- Backfill existing shipped/delivered orders' fulfillment_status
UPDATE orders SET fulfillment_status = 'SHIPPED' WHERE status = 'SHIPPED' AND fulfillment_status = 'PENDING_REVIEW';
UPDATE orders SET fulfillment_status = 'DELIVERED' WHERE status = 'DELIVERED' AND fulfillment_status = 'PENDING_REVIEW';

-- 5. After-sales tickets table
CREATE TABLE IF NOT EXISTS after_sales_tickets (
    id              BIGINT        NOT NULL AUTO_INCREMENT,
    ticket_number   VARCHAR(64)   NOT NULL,
    order_number    VARCHAR(64)   NOT NULL,
    user_id         BIGINT        NOT NULL,
    category        VARCHAR(32)   NOT NULL,
    reason          VARCHAR(1000) NOT NULL,
    contact_info    VARCHAR(255)  NULL,
    status          VARCHAR(32)   NOT NULL DEFAULT 'OPEN',
    assignee        VARCHAR(120)  NULL,
    resolution_note VARCHAR(1000) NULL,
    next_contact_at DATETIME      NULL,
    created_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT uk_after_sales_ticket_number UNIQUE (ticket_number),
    INDEX idx_after_sales_order_number (order_number),
    INDEX idx_after_sales_user_id (user_id),
    INDEX idx_after_sales_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. System settings table (e.g. checkout kill switch)
CREATE TABLE IF NOT EXISTS system_settings (
    setting_key   VARCHAR(64)  NOT NULL,
    setting_value VARCHAR(512) NOT NULL,
    updated_by    VARCHAR(255) NULL,
    updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO system_settings (setting_key, setting_value, updated_by)
VALUES ('checkout_enabled', 'true', 'system');
