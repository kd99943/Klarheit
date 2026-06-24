-- V8__seed_catalog_data_and_fixes.sql
-- Seeds catalog data previously handled by DataInitializer.java,
-- adds database-level defaults, and cleans up legacy columns.

-- Ensure this session uses utf8mb4 so Chinese characters in INSERT statements work correctly.
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 1. Seed products (skip if already present)
INSERT IGNORE INTO products (name, material, base_price, image_url, name_en, name_zh, material_en, material_zh)
VALUES
    ('AERO X1',     'Grade 5 Titanium',             850.00, '/images/aero_x1.png',     'AERO X1',     'AERO X1',     'Grade 5 Titanium',             '5级钛金属'),
    ('MONOLITH 02', 'Japanese Acetate',             620.00, '/images/monolith_02.png', 'MONOLITH 02', 'MONOLITH 02', 'Japanese Acetate',             '日本板材'),
    ('ORBIT T-4',   'Surgical Steel / Titanium',    950.00, '/images/orbit_t4.png',    'ORBIT T-4',   'ORBIT T-4',   'Surgical Steel / Titanium',    '外科手术钢 / 钛金属'),
    ('LUCENT V1',   'Crystal Acetate',              580.00, '/images/lucent_v1.png',   'LUCENT V1',   'LUCENT V1',   'Crystal Acetate',              '水晶板材');

-- 2. Ensure image URLs and localized fields are correct for existing products
UPDATE products SET
    image_url   = '/images/aero_x1.png',
    name        = name_en,
    material    = material_en
WHERE name_en = 'AERO X1' AND (image_url IS NULL OR image_url NOT LIKE '/images/%');

UPDATE products SET
    image_url   = '/images/monolith_02.png',
    name        = name_en,
    material    = material_en
WHERE name_en = 'MONOLITH 02' AND (image_url IS NULL OR image_url NOT LIKE '/images/%');

UPDATE products SET
    image_url   = '/images/orbit_t4.png',
    name        = name_en,
    material    = material_en
WHERE name_en = 'ORBIT T-4' AND (image_url IS NULL OR image_url NOT LIKE '/images/%');

UPDATE products SET
    image_url   = '/images/lucent_v1.png',
    name        = name_en,
    material    = material_en
WHERE name_en = 'LUCENT V1' AND (image_url IS NULL OR image_url NOT LIKE '/images/%');

-- 3. Seed lens options (skip if already present)
INSERT IGNORE INTO lens_options (type, index_value, additional_price, category, label, description)
VALUES
    ('HIGH_INDEX_174', 1.74, 215.00, 'LENS',    'Custom Lenses (High-Index)', 'Thin 1.74 index lenses for stronger prescriptions.'),
    ('AR_ONYX',        0.00,  60.00, 'COATING', 'Onyx AR Coating',            'Premium anti-reflective coating for glare reduction.'),
    ('HEV_BLUE',       0.00,  30.00, 'COATING', 'HEV Filter',                 'Blue light filtering treatment for daily screen use.');

-- 4. Add unique constraint on (product_id, finish_id) for AR configs.
--    Moved to V11 to keep this file idempotent (INSERT IGNORE + UPDATE only).

-- 5. Make legacy name/material columns nullable.
--    Moved to V11 to keep this file idempotent.
