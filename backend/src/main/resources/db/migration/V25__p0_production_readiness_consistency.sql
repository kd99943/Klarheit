-- V25__p0_production_readiness_consistency.sql
-- Implements P0 Production Readiness Audit schema & data consistency foundations:
-- 1. P0-02: SKU physical stocktake verification, committed_qty tracking, safe V24 backfill reconciliation,
--           and review/quote hold expiry deadlines
-- 2. P0-03: Immutable versioned quotes (order_quote_versions) & order quote_version / quote_change_summary
-- 3. P0-04: Prescription version binding, initial shipment vs tracking update audit table (order_shipment_events),
--           duplicate shipping notification dedup
-- 4. P0-05: Structured shipping address fields, shipping fee, delivery manual review flag, initial_promised_source
-- 5. P0-06 & P0-08: Itemized refund ledger (refund_transactions) separating requested vs confirmed refunds by timestamp,
--                   plus actual shipping/payment/remake cost columns for true contribution accounting
-- 6. P0-07: Order-level physical return restock guard & after-sales return receipt/QC/disposition evidence

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 1. Versioned pre-payment quote history (P0-03)
CREATE TABLE IF NOT EXISTS order_quote_versions (
    id                      BIGINT         AUTO_INCREMENT PRIMARY KEY,
    order_number            VARCHAR(64)    NOT NULL,
    version_number          INT            NOT NULL,
    product_id              BIGINT         NULL,
    sku_id                  BIGINT         NULL,
    finish_id               VARCHAR(64)    NULL,
    size_spec               VARCHAR(64)    NULL,
    lens_options_snapshot   JSON           NULL,
    quoted_amount           DECIMAL(10, 2) NOT NULL,
    promised_delivery_date  DATE           NULL,
    expires_at              DATETIME       NULL,
    quote_note              VARCHAR(512)   NULL,
    change_summary          VARCHAR(512)   NULL,
    created_by              VARCHAR(120)   NULL,
    created_at              DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at            DATETIME       NULL,
    UNIQUE KEY uk_order_quote_version (order_number, version_number),
    INDEX idx_order_quote_order_number (order_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Itemized refund transaction ledger (P0-06 & P0-08)
CREATE TABLE IF NOT EXISTS refund_transactions (
    id                      BIGINT         AUTO_INCREMENT PRIMARY KEY,
    refund_request_id       VARCHAR(128)   NOT NULL,
    order_number            VARCHAR(64)    NOT NULL,
    ticket_number           VARCHAR(64)    NULL,
    requested_amount        DECIMAL(10, 2) NOT NULL,
    confirmed_amount        DECIMAL(10, 2) NULL,
    status                  VARCHAR(32)    NOT NULL DEFAULT 'REQUESTED',
    payment_channel         VARCHAR(32)    NULL,
    gateway_refund_id       VARCHAR(128)   NULL,
    manual_voucher_ref      VARCHAR(128)   NULL,
    reason                  VARCHAR(512)   NULL,
    failure_message         VARCHAR(512)   NULL,
    requested_by            VARCHAR(120)   NULL,
    requested_at            DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confirmed_at            DATETIME       NULL,
    finance_verified_by     VARCHAR(120)   NULL,
    finance_verified_at     DATETIME       NULL,
    UNIQUE KEY uk_refund_tx_request_id (refund_request_id),
    INDEX idx_refund_tx_order (order_number),
    INDEX idx_refund_tx_ticket (ticket_number),
    INDEX idx_refund_tx_status (status),
    INDEX idx_refund_tx_confirmed_at (confirmed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Shipment & tracking update events (P0-04)
CREATE TABLE IF NOT EXISTS order_shipment_events (
    id                        BIGINT       AUTO_INCREMENT PRIMARY KEY,
    order_number              VARCHAR(64)  NOT NULL,
    event_type                VARCHAR(32)  NOT NULL,
    carrier                   VARCHAR(100) NOT NULL,
    tracking_number           VARCHAR(100) NOT NULL,
    previous_carrier          VARCHAR(100) NULL,
    previous_tracking_number  VARCHAR(100) NULL,
    note                      VARCHAR(512) NULL,
    operator_email            VARCHAR(120) NULL,
    notification_sent         BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at                DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_shipment_events_order (order_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP PROCEDURE IF EXISTS EnsureV25SchemaUpdates;
DELIMITER //
CREATE PROCEDURE EnsureV25SchemaUpdates()
BEGIN
    -- A. product_skus: physical stocktake & committed_qty
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'product_skus' AND column_name = 'committed_qty') THEN
        ALTER TABLE product_skus ADD COLUMN committed_qty INT NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'product_skus' AND column_name = 'stocktake_verified') THEN
        ALTER TABLE product_skus ADD COLUMN stocktake_verified BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'product_skus' AND column_name = 'stocktake_at') THEN
        ALTER TABLE product_skus ADD COLUMN stocktake_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'product_skus' AND column_name = 'stocktake_by') THEN
        ALTER TABLE product_skus ADD COLUMN stocktake_by VARCHAR(120) NULL;
    END IF;

    -- B. orders: quote versioning, hold expiry, rx version, shipment/tracking dedup, delivery check, refund split, physical restock lock, costs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'quote_version') THEN
        ALTER TABLE orders ADD COLUMN quote_version INT NOT NULL DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'quote_expires_at') THEN
        ALTER TABLE orders ADD COLUMN quote_expires_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'review_expires_at') THEN
        ALTER TABLE orders ADD COLUMN review_expires_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'quote_change_summary') THEN
        ALTER TABLE orders ADD COLUMN quote_change_summary VARCHAR(512) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'prescription_version') THEN
        ALTER TABLE orders ADD COLUMN prescription_version INT NOT NULL DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'optician_verified_rx_version') THEN
        ALTER TABLE orders ADD COLUMN optician_verified_rx_version INT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'first_shipped_at') THEN
        ALTER TABLE orders ADD COLUMN first_shipped_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'shipping_notified_tracking') THEN
        ALTER TABLE orders ADD COLUMN shipping_notified_tracking VARCHAR(100) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'shipping_province') THEN
        ALTER TABLE orders ADD COLUMN shipping_province VARCHAR(64) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'shipping_city') THEN
        ALTER TABLE orders ADD COLUMN shipping_city VARCHAR(64) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'shipping_district') THEN
        ALTER TABLE orders ADD COLUMN shipping_district VARCHAR(64) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'shipping_detail_address') THEN
        ALTER TABLE orders ADD COLUMN shipping_detail_address VARCHAR(512) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'shipping_fee') THEN
        ALTER TABLE orders ADD COLUMN shipping_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'delivery_review_required') THEN
        ALTER TABLE orders ADD COLUMN delivery_review_required BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'initial_promised_source') THEN
        ALTER TABLE orders ADD COLUMN initial_promised_source VARCHAR(32) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'confirmed_refund_amount') THEN
        ALTER TABLE orders ADD COLUMN confirmed_refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'pending_refund_amount') THEN
        ALTER TABLE orders ADD COLUMN pending_refund_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'return_restocked') THEN
        ALTER TABLE orders ADD COLUMN return_restocked BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'return_restocked_by_ticket') THEN
        ALTER TABLE orders ADD COLUMN return_restocked_by_ticket VARCHAR(64) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'return_restocked_at') THEN
        ALTER TABLE orders ADD COLUMN return_restocked_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'shipping_cost_amount') THEN
        ALTER TABLE orders ADD COLUMN shipping_cost_amount DECIMAL(10, 2) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'orders' AND column_name = 'payment_fee_amount') THEN
        ALTER TABLE orders ADD COLUMN payment_fee_amount DECIMAL(10, 2) NULL;
    END IF;

    -- C. after_sales_tickets: physical return receipt, QC operator/time, disposition, remake/return costs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'return_received_by') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN return_received_by VARCHAR(120) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'return_qc_checked_by') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN return_qc_checked_by VARCHAR(120) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'return_qc_checked_at') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN return_qc_checked_at DATETIME NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'return_disposition') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN return_disposition VARCHAR(64) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'return_evidence_note') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN return_evidence_note VARCHAR(512) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'remake_cost_amount') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN remake_cost_amount DECIMAL(10, 2) NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'after_sales_tickets' AND column_name = 'return_shipping_cost') THEN
        ALTER TABLE after_sales_tickets ADD COLUMN return_shipping_cost DECIMAL(10, 2) NULL;
    END IF;
END //
DELIMITER ;
CALL EnsureV25SchemaUpdates();
DROP PROCEDURE EnsureV25SchemaUpdates;

-- 4. P0-02: Reconcile V24 auto-backfilled SKU inventory safely without fabricating stock
-- 4a. Zero-stock or non-available products must NEVER become sellable with on_hand_qty=1
UPDATE product_skus s
JOIN products p ON p.id = s.product_id
SET s.on_hand_qty = 0,
    s.sales_status = CASE
        WHEN p.sales_status IS NOT NULL AND p.sales_status <> 'AVAILABLE' THEN p.sales_status
        ELSE 'OUT_OF_STOCK'
    END
WHERE s.stocktake_verified = FALSE
  AND s.supplier_name = 'Klarheit Pilot Lab'
  AND (COALESCE(p.stock_quantity, 0) <= 0 OR COALESCE(p.sales_status, 'AVAILABLE') <> 'AVAILABLE');

-- 4b. Multi-SKU products with unverified V24 auto-backfill must stay PAUSED (pending physical stocktake)
--     instead of duplicating product.stock_quantity across every finish.
UPDATE product_skus s
JOIN (
    SELECT product_id
    FROM product_skus
    GROUP BY product_id
    HAVING COUNT(*) > 1
) multi ON multi.product_id = s.product_id
SET s.on_hand_qty = 0,
    s.sales_status = 'PAUSED'
WHERE s.stocktake_verified = FALSE
  AND s.supplier_name = 'Klarheit Pilot Lab';

-- 4c. Single-SKU unverified auto-backfilled products reflect exact legacy product stock (never inflated)
UPDATE product_skus s
JOIN products p ON p.id = s.product_id
JOIN (
    SELECT product_id
    FROM product_skus
    GROUP BY product_id
    HAVING COUNT(*) = 1
) single_sku ON single_sku.product_id = s.product_id
SET s.on_hand_qty = GREATEST(0, COALESCE(p.stock_quantity, 0))
WHERE s.stocktake_verified = FALSE
  AND s.supplier_name = 'Klarheit Pilot Lab'
  AND COALESCE(p.stock_quantity, 0) > 0;

-- 4d. Account for historical PAID unshipped orders whose SKU stock was not yet committed
UPDATE product_skus s
JOIN (
    SELECT o.sku_id, COUNT(*) AS cnt
    FROM orders o
    WHERE o.status = 'PAID'
      AND o.sku_id IS NOT NULL
      AND o.sku_stock_committed = FALSE
    GROUP BY o.sku_id
) pending_paid ON pending_paid.sku_id = s.id
SET s.committed_qty = GREATEST(s.committed_qty, pending_paid.cnt);

-- 4e. Sync aggregate product.stock_quantity from actual AVAILABLE SKU quantities
UPDATE products p
JOIN (
    SELECT product_id,
           COALESCE(SUM(CASE
               WHEN sales_status = 'AVAILABLE' AND on_hand_qty > (reserved_qty + committed_qty)
               THEN (on_hand_qty - reserved_qty - committed_qty)
               ELSE 0
           END), 0) AS total_avail
    FROM product_skus
    GROUP BY product_id
) agg ON agg.product_id = p.id
SET p.stock_quantity = agg.total_avail;

-- 5. Mark historical V24-backfilled initial_promised_delivery_date so SLA reporting identifies migrated estimates
UPDATE orders
SET initial_promised_source = 'MIGRATION_BACKFILLED'
WHERE initial_promised_delivery_date IS NOT NULL
  AND initial_promised_source IS NULL;

-- 6. Mark historical optician_verified orders with rx version 1 so historical fulfilled orders remain consistent
UPDATE orders
SET optician_verified_rx_version = prescription_version
WHERE optician_verified_at IS NOT NULL
  AND optician_verified_rx_version IS NULL;

-- 7. Mark historical shipped/delivered orders' first_shipped_at & shipping_notified_tracking
UPDATE orders
SET first_shipped_at = COALESCE(delivered_at, paid_at, created_at),
    shipping_notified_tracking = tracking_number
WHERE status IN ('SHIPPED', 'DELIVERED')
  AND first_shipped_at IS NULL;

-- 8. Backfill historical order-level return_restocked from already-restocked after-sales tickets
UPDATE orders o
JOIN (
    SELECT order_number, MIN(ticket_number) AS first_ticket, MIN(updated_at) AS restocked_at
    FROM after_sales_tickets
    WHERE return_restocked = TRUE
    GROUP BY order_number
) rt ON rt.order_number COLLATE utf8mb4_unicode_ci = o.order_number COLLATE utf8mb4_unicode_ci
SET o.return_restocked = TRUE,
    o.return_restocked_by_ticket = rt.first_ticket,
    o.return_restocked_at = rt.restocked_at
WHERE o.return_restocked = FALSE;

-- 9. Backfill historical confirmed/pending refunds into orders & refund_transactions
UPDATE orders
SET confirmed_refund_amount = COALESCE(refund_amount, 0.00)
WHERE status IN ('REFUNDED', 'SHIPPED', 'DELIVERED', 'PAID')
  AND refund_amount IS NOT NULL
  AND refund_amount > 0
  AND confirmed_refund_amount = 0.00;

UPDATE orders
SET pending_refund_amount = COALESCE(refund_amount, 0.00)
WHERE status = 'REFUND_PENDING'
  AND refund_amount IS NOT NULL
  AND refund_amount > 0
  AND pending_refund_amount = 0.00;

INSERT IGNORE INTO refund_transactions (
    refund_request_id, order_number, requested_amount, confirmed_amount, status,
    payment_channel, gateway_refund_id, reason, requested_at, confirmed_at
)
SELECT
    COALESCE(NULLIF(o.refund_request_id, ''), CONCAT(o.order_number, '-LEGACY-RF')),
    o.order_number,
    o.refund_amount,
    CASE WHEN o.status = 'REFUND_PENDING' THEN NULL ELSE o.refund_amount END,
    CASE WHEN o.status = 'REFUND_PENDING' THEN 'PENDING_CHANNEL' ELSE 'CONFIRMED' END,
    o.payment_channel,
    o.refund_request_id,
    COALESCE(o.refund_reason, 'Legacy migrated refund'),
    COALESCE(o.paid_at, o.created_at),
    CASE WHEN o.status = 'REFUND_PENDING' THEN NULL ELSE COALESCE(o.paid_at, o.created_at) END
FROM orders o
WHERE o.refund_amount IS NOT NULL
  AND o.refund_amount > 0;
