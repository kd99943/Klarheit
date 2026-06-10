-- V5__payment_and_coupon_init.sql

-- 1. 创建优惠券规则表
CREATE TABLE IF NOT EXISTS coupons (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(64) NOT NULL UNIQUE,
    type VARCHAR(32) NOT NULL,
    `value` DECIMAL(10, 2) NOT NULL,
    min_spend DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    active TINYINT(1) NOT NULL DEFAULT 1,
    expires_at DATETIME NOT NULL,
    max_usages INT NOT NULL DEFAULT 9999,
    used_count INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. 向订单表中追加支付通道与营销数据字段
ALTER TABLE orders ADD COLUMN payment_channel VARCHAR(32) NULL;
ALTER TABLE orders ADD COLUMN gateway_transaction_id VARCHAR(255) NULL;
ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE orders ADD COLUMN applied_coupon_code VARCHAR(64) NULL;
ALTER TABLE orders ADD COLUMN paid_at DATETIME NULL;

-- 3. 建立对账和 Webhook 检索索引
CREATE INDEX idx_orders_gateway_tx_id ON orders(gateway_transaction_id);

-- 4. 初始化一张早鸟满减优惠券，用于上线测试
INSERT INTO coupons (code, type, `value`, min_spend, active, expires_at) 
VALUES ('KLARHEIT80', 'FIXED_AMOUNT', 80.00, 500.00, 1, '2027-12-31 23:59:59');
