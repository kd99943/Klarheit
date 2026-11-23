-- V24__business_operations_sku_prepay_aftersales_reconciliation.sql
-- Implements Business Operations Plan (P0-1, P0-2, P0-3, P1):
-- 1. SKU-level inventory (finish + size + supplier + on_hand/reserved + restock_eta + unit_cost)
-- 2. Pre-payment compatibility review & quote confirmation, immutable initial_promised_delivery_date,
--    delivery delay reason, optician verification, QC results, order source & unit economics cost
-- 3. Post-shipment after-sales execution: return logistics, return QC & idempotent restock,
--    remake tracking linkage, post-ship refund & finance verification, root cause tagging

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_skus (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    finish_id VARCHAR(64) NOT NULL,
    size_spec VARCHAR(64) NOT NULL,
    supplier_name VARCHAR(120) NULL,
    on_hand_qty INT NOT NULL DEFAULT 10,
    reserved_qty INT NOT NULL DEFAULT 0,
    sales_status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
    restock_eta DATE NULL,
    unit_cost DECIMAL(10, 2) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_product_sku (product_id, finish_id, size_spec),
    INDEX idx_product_skus_product (product_id),
    CONSTRAINT fk_product_skus_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS EnsureV24SchemaUpdates;
DELIMITER //
CREATE PROCEDURE EnsureV24SchemaUpdates()
BEGIN
    -- 1. Orders: SKU linkage, immutable initial promised date, pre-pay review, optician/QC audit, economics
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'sku_id') THEN
        ALTER TABLE orders ADD COLUMN sku_id BIGINT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'size_spec_snapshot') THEN
        ALTER TABLE orders ADD COLUMN size_spec_snapshot VARCHAR(64) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'sku_stock_committed') THEN
        ALTER TABLE orders ADD COLUMN sku_stock_committed BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'initial_promised_delivery_date') THEN
        ALTER TABLE orders ADD COLUMN initial_promised_delivery_date DATE NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivery_delay_reason') THEN
        ALTER TABLE orders ADD COLUMN delivery_delay_reason VARCHAR(512) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'requires_prepay_review') THEN
        ALTER TABLE orders ADD COLUMN requires_prepay_review BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'prepay_review_reason') THEN
        ALTER TABLE orders ADD COLUMN prepay_review_reason VARCHAR(512) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'quote_note') THEN
        ALTER TABLE orders ADD COLUMN quote_note VARCHAR(512) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'quote_revised_amount') THEN
        ALTER TABLE orders ADD COLUMN quote_revised_amount DECIMAL(10, 2) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'customer_quote_confirmed_at') THEN
        ALTER TABLE orders ADD COLUMN customer_quote_confirmed_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'optician_verified_by') THEN
        ALTER TABLE orders ADD COLUMN optician_verified_by VARCHAR(120) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'optician_verified_at') THEN
        ALTER TABLE orders ADD COLUMN optician_verified_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'qc_status') THEN
        ALTER TABLE orders ADD COLUMN qc_status VARCHAR(32) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'qc_note') THEN
        ALTER TABLE orders ADD COLUMN qc_note VARCHAR(512) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'qc_checked_by') THEN
        ALTER TABLE orders ADD COLUMN qc_checked_by VARCHAR(120) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'qc_checked_at') THEN
        ALTER TABLE orders ADD COLUMN qc_checked_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'order_source') THEN
        ALTER TABLE orders ADD COLUMN order_source VARCHAR(64) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'variable_cost_amount') THEN
        ALTER TABLE orders ADD COLUMN variable_cost_amount DECIMAL(10, 2) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'parent_order_number') THEN
        ALTER TABLE orders ADD COLUMN parent_order_number VARCHAR(64) NULL;
    END IF;

    -- 2. After-sales tickets: return logistics, return QC & restock, remake linkage, refund & finance verification, root cause
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'return_carrier') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN return_carrier VARCHAR(100) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'return_tracking_number') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN return_tracking_number VARCHAR(100) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'return_received_at') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN return_received_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'return_qc_result') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN return_qc_result VARCHAR(32) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'return_qc_note') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN return_qc_note VARCHAR(512) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'return_restocked') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN return_restocked BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'remake_order_number') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN remake_order_number VARCHAR(64) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'remake_carrier') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN remake_carrier VARCHAR(100) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'remake_tracking_number') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN remake_tracking_number VARCHAR(100) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'refund_amount') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN refund_amount DECIMAL(10, 2) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'refund_transaction_id') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN refund_transaction_id VARCHAR(128) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'finance_verified_by') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN finance_verified_by VARCHAR(120) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'finance_verified_at') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN finance_verified_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'root_cause') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN root_cause VARCHAR(64) NULL;
    END IF;
END //
DELIMITER ;
CALL EnsureV24SchemaUpdates();
DROP PROCEDURE EnsureV24SchemaUpdates;

-- Backfill initial_promised_delivery_date for existing orders so SLA calculation has a baseline
UPDATE orders
SET initial_promised_delivery_date = COALESCE(estimated_delivery_date, DATE_ADD(DATE(created_at), INTERVAL 14 DAY))
WHERE initial_promised_delivery_date IS NULL;

-- Backfill SKU rows from existing product_ar_configs (idempotent via INSERT IGNORE)
INSERT IGNORE INTO product_skus (product_id, finish_id, size_spec, supplier_name, on_hand_qty, reserved_qty, sales_status)
SELECT p.id, ac.finish_id, p.specs_size, 'Klarheit Pilot Lab',
       GREATEST(1, LEAST(COALESCE(p.stock_quantity, 10), 20)),
       0,
       COALESCE(p.sales_status, 'AVAILABLE')
FROM products p
JOIN product_ar_configs ac ON ac.product_id = p.id;
