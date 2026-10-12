-- V12__add_addresses_table_and_order_tracking.sql
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 1. Create addresses table
CREATE TABLE IF NOT EXISTS addresses (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    recipient_name VARCHAR(120) NOT NULL,
    phone_number VARCHAR(20) NOT NULL,
    province VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL,
    district VARCHAR(100) NULL,
    detail_address VARCHAR(255) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_addresses_user_id ON addresses (user_id);

-- 2. Add shape, specs_size, detail_images to products table
ALTER TABLE products ADD COLUMN shape VARCHAR(60) NOT NULL DEFAULT 'ROUND';
ALTER TABLE products ADD COLUMN specs_size VARCHAR(120) NOT NULL DEFAULT '52-18-145';
ALTER TABLE products ADD COLUMN detail_images TEXT NULL;

-- Update seeded products with specific shapes, specs, and details
UPDATE products SET shape = 'RECTANGLE', specs_size = '54-17-140', detail_images = '/images/aero_x1.png' WHERE name_en = 'AERO X1';
UPDATE products SET shape = 'SQUARE', specs_size = '50-20-145', detail_images = '/images/monolith_02.png' WHERE name_en = 'MONOLITH 02';
UPDATE products SET shape = 'ROUND', specs_size = '48-21-140', detail_images = '/images/orbit_t4.png' WHERE name_en = 'ORBIT T-4';
UPDATE products SET shape = 'ROUND', specs_size = '49-19-142', detail_images = '/images/lucent_v1.png' WHERE name_en = 'LUCENT V1';

-- 3. Add carrier and tracking_number to orders table
ALTER TABLE orders ADD COLUMN carrier VARCHAR(100) NULL;
ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(100) NULL;
