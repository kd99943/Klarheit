-- V27__expand_frame_catalog.sql
-- Expands the built-in eyewear catalog from 4 frames to 8 distinct silhouettes:
--   5. SOLARIS A1 (AVIATOR)   - Champagne Gold Double-Bridge Aviator
--   6. VELVET C3  (CAT_EYE)   - Deep Burgundy Sculpted Cat-Eye Acetate
--   7. PRISM H6   (GEOMETRIC) - Gunmetal Slim Hexagonal Wire
--   8. AMBER R5   (RECTANGLE) - Translucent Amber Narrow Rectangle Acetate
-- Each new frame includes localized metadata, studio front + detail photos,
-- matching GLB AR configurations for two finishes, and stocktake-verified SKUs.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 1. Seed the 4 new eyewear products idempotently (keyed by name_en)
INSERT INTO products (
    name, material, base_price, image_url,
    name_en, name_zh, material_en, material_zh,
    shape, specs_size, detail_images, stock_quantity, sales_status
)
SELECT
    'SOLARIS A1', 'Grade 5 Titanium', 890.00, '/images/solaris_a1.jpg',
    'SOLARIS A1', 'SOLARIS A1 香槟金飞行员', 'Grade 5 Titanium', '5级钛金属',
    'AVIATOR', '56-16-145', '/images/solaris_a1_detail.jpg', 20, 'AVAILABLE'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name_en = 'SOLARIS A1');

INSERT INTO products (
    name, material, base_price, image_url,
    name_en, name_zh, material_en, material_zh,
    shape, specs_size, detail_images, stock_quantity, sales_status
)
SELECT
    'VELVET C3', 'Japanese Acetate', 720.00, '/images/velvet_c3.jpg',
    'VELVET C3', 'VELVET C3 酒红猫眼框', 'Japanese Acetate', '日本板材',
    'CAT_EYE', '52-18-142', '/images/velvet_c3_detail.jpg', 18, 'AVAILABLE'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name_en = 'VELVET C3');

INSERT INTO products (
    name, material, base_price, image_url,
    name_en, name_zh, material_en, material_zh,
    shape, specs_size, detail_images, stock_quantity, sales_status
)
SELECT
    'PRISM H6', 'Surgical Steel / Titanium', 780.00, '/images/prism_h6.jpg',
    'PRISM H6', 'PRISM H6 枪灰六角细框', 'Surgical Steel / Titanium', '外科手术钢 / 钛金属',
    'GEOMETRIC', '50-19-145', '/images/prism_h6_detail.jpg', 22, 'AVAILABLE'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name_en = 'PRISM H6');

INSERT INTO products (
    name, material, base_price, image_url,
    name_en, name_zh, material_en, material_zh,
    shape, specs_size, detail_images, stock_quantity, sales_status
)
SELECT
    'AMBER R5', 'Crystal Acetate', 660.00, '/images/amber_r5.jpg',
    'AMBER R5', 'AMBER R5 琥珀窄矩形框', 'Crystal Acetate', '水晶板材',
    'RECTANGLE', '53-18-145', '/images/amber_r5_detail.jpg', 20, 'AVAILABLE'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE name_en = 'AMBER R5');

-- 2. Seed AR configs (default photo finish inserted first per product)
-- SOLARIS A1 finishes
INSERT IGNORE INTO product_ar_configs (
    product_id, finish_id, finish_label_key, lens_label, lens_label_en, lens_label_zh,
    fit_label_key, frame_color, lens_color, model_url, model_scale_mode, legacy_materials,
    position_x, position_y, position_z, rotation_x, rotation_y, rotation_z, scale
)
SELECT p.id, 'champagne-gold', 'color.champagneGold', 'Neutral Clear', 'Neutral Clear', '自然高清无色',
       'fit.softDaylight', '#d4b483', '#f0f4f8', '/models/frames/solaris_a1.glb', 'normalized', NULL,
       0.0000, -0.0280, 0.0000, 0.0000, 0.0000, 0.0000, 1.0000
FROM products p WHERE p.name_en = 'SOLARIS A1';

INSERT IGNORE INTO product_ar_configs (
    product_id, finish_id, finish_label_key, lens_label, lens_label_en, lens_label_zh,
    fit_label_key, frame_color, lens_color, model_url, model_scale_mode, legacy_materials,
    position_x, position_y, position_z, rotation_x, rotation_y, rotation_z, scale
)
SELECT p.id, 'gunmetal', 'color.gunmetal', 'Onyx AR', 'Onyx AR', '黑玛瑙增透膜',
       'fit.urbanContrast', '#4a5058', '#e6eef5', '/models/frames/solaris_a1.glb', 'normalized', NULL,
       0.0000, -0.0280, 0.0000, 0.0000, 0.0000, 0.0000, 1.0000
FROM products p WHERE p.name_en = 'SOLARIS A1';

-- VELVET C3 finishes
INSERT IGNORE INTO product_ar_configs (
    product_id, finish_id, finish_label_key, lens_label, lens_label_en, lens_label_zh,
    fit_label_key, frame_color, lens_color, model_url, model_scale_mode, legacy_materials,
    position_x, position_y, position_z, rotation_x, rotation_y, rotation_z, scale
)
SELECT p.id, 'burgundy', 'color.burgundy', 'Onyx AR', 'Onyx AR', '黑玛瑙增透膜',
       'fit.softDaylight', '#6b1d2f', '#eef4f8', '/models/frames/velvet_c3.glb', 'normalized', NULL,
       0.0000, -0.0280, 0.0000, 0.0000, 0.0000, 0.0000, 1.0000
FROM products p WHERE p.name_en = 'VELVET C3';

INSERT IGNORE INTO product_ar_configs (
    product_id, finish_id, finish_label_key, lens_label, lens_label_en, lens_label_zh,
    fit_label_key, frame_color, lens_color, model_url, model_scale_mode, legacy_materials,
    position_x, position_y, position_z, rotation_x, rotation_y, rotation_z, scale
)
SELECT p.id, 'matte-black', 'color.matteBlack', 'Onyx AR', 'Onyx AR', '黑玛瑙增透膜',
       'fit.urbanContrast', '#141416', '#e8f4f6', '/models/frames/velvet_c3.glb', 'normalized', NULL,
       0.0000, -0.0280, 0.0000, 0.0000, 0.0000, 0.0000, 1.0000
FROM products p WHERE p.name_en = 'VELVET C3';

-- PRISM H6 finishes
INSERT IGNORE INTO product_ar_configs (
    product_id, finish_id, finish_label_key, lens_label, lens_label_en, lens_label_zh,
    fit_label_key, frame_color, lens_color, model_url, model_scale_mode, legacy_materials,
    position_x, position_y, position_z, rotation_x, rotation_y, rotation_z, scale
)
SELECT p.id, 'gunmetal', 'color.gunmetal', 'Neutral Clear', 'Neutral Clear', '自然高清无色',
       'fit.studioNeutral', '#525860', '#e6eef5', '/models/frames/prism_h6.glb', 'normalized', NULL,
       0.0000, -0.0280, 0.0000, 0.0000, 0.0000, 0.0000, 1.0000
FROM products p WHERE p.name_en = 'PRISM H6';

INSERT IGNORE INTO product_ar_configs (
    product_id, finish_id, finish_label_key, lens_label, lens_label_en, lens_label_zh,
    fit_label_key, frame_color, lens_color, model_url, model_scale_mode, legacy_materials,
    position_x, position_y, position_z, rotation_x, rotation_y, rotation_z, scale
)
SELECT p.id, 'brushed-silver', 'color.brushedSilver', 'Neutral Clear', 'Neutral Clear', '自然高清无色',
       'fit.studioNeutral', '#aeb5bd', '#eef3f6', '/models/frames/prism_h6.glb', 'normalized', NULL,
       0.0000, -0.0280, 0.0000, 0.0000, 0.0000, 0.0000, 1.0000
FROM products p WHERE p.name_en = 'PRISM H6';

-- AMBER R5 finishes
INSERT IGNORE INTO product_ar_configs (
    product_id, finish_id, finish_label_key, lens_label, lens_label_en, lens_label_zh,
    fit_label_key, frame_color, lens_color, model_url, model_scale_mode, legacy_materials,
    position_x, position_y, position_z, rotation_x, rotation_y, rotation_z, scale
)
SELECT p.id, 'amber-tortoise', 'color.amberTortoise', 'Warm HEV', 'Warm HEV', '暖色防蓝光',
       'fit.softDaylight', '#b46a28', '#f5f1e8', '/models/frames/amber_r5.glb', 'normalized', NULL,
       0.0000, -0.0280, 0.0000, 0.0000, 0.0000, 0.0000, 1.0000
FROM products p WHERE p.name_en = 'AMBER R5';

INSERT IGNORE INTO product_ar_configs (
    product_id, finish_id, finish_label_key, lens_label, lens_label_en, lens_label_zh,
    fit_label_key, frame_color, lens_color, model_url, model_scale_mode, legacy_materials,
    position_x, position_y, position_z, rotation_x, rotation_y, rotation_z, scale
)
SELECT p.id, 'matte-black', 'color.matteBlack', 'Onyx AR', 'Onyx AR', '黑玛瑙增透膜',
       'fit.urbanContrast', '#1c1d21', '#e8f4f6', '/models/frames/amber_r5.glb', 'normalized', NULL,
       0.0000, -0.0280, 0.0000, 0.0000, 0.0000, 0.0000, 1.0000
FROM products p WHERE p.name_en = 'AMBER R5';

-- 3. Seed stocktake-verified sellable SKUs for the 4 new products (matching finish_id & size_spec)
INSERT IGNORE INTO product_skus (
    product_id, finish_id, size_spec, supplier_name,
    on_hand_qty, reserved_qty, committed_qty, sales_status,
    unit_cost, stocktake_verified, stocktake_at, stocktake_by
)
SELECT p.id, t.finish_id, p.specs_size, 'Klarheit Studio Atelier',
       t.on_hand_qty, 0, 0, 'AVAILABLE',
       t.unit_cost, TRUE, CURRENT_TIMESTAMP, 'catalog-seed'
FROM products p
JOIN (
    SELECT 'SOLARIS A1' AS name_en, 'champagne-gold' AS finish_id, 12 AS on_hand_qty, 310.00 AS unit_cost
    UNION ALL
    SELECT 'SOLARIS A1', 'gunmetal', 8, 310.00
    UNION ALL
    SELECT 'VELVET C3', 'burgundy', 10, 245.00
    UNION ALL
    SELECT 'VELVET C3', 'matte-black', 8, 245.00
    UNION ALL
    SELECT 'PRISM H6', 'gunmetal', 12, 275.00
    UNION ALL
    SELECT 'PRISM H6', 'brushed-silver', 10, 275.00
    UNION ALL
    SELECT 'AMBER R5', 'amber-tortoise', 12, 220.00
    UNION ALL
    SELECT 'AMBER R5', 'matte-black', 8, 220.00
) t ON t.name_en = p.name_en;
