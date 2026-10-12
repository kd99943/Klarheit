-- V17__seed_aero_x1_ar_configs.sql
-- Seeds the three ProductArConfig rows for the AERO X1 product.
--
-- Previously this data was upserted on every application startup by
-- DataInitializer.seedProductArConfigs(), which:
--   1. Performed unnecessary DB writes on every restart.
--   2. Created a second source of truth alongside Flyway.
--   3. Silently overwrote any manual adjustments made via the admin UI.
--
-- Moving the seed data into Flyway consolidates catalog seeding into a
-- single immutable source. The (product_id, finish_id) UNIQUE constraint
-- added in V11 makes INSERT IGNORE safe: existing rows are left untouched.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AERO X1 is seeded by V8; resolve its id at migration time.
INSERT IGNORE INTO product_ar_configs
    (product_id, finish_id, finish_label_key, lens_label, lens_label_en, lens_label_zh,
     fit_label_key, frame_color, lens_color, model_url,
     position_x, position_y, position_z,
     rotation_x, rotation_y, rotation_z, scale)
SELECT p.id, t.finish_id, t.finish_label_key, t.lens_label, t.lens_label_en, t.lens_label_zh,
       t.fit_label_key, t.frame_color, t.lens_color, NULL,
       0.0000, -0.0300, 0.0000,
       0.0000, 0.0000, 0.0000, 1.0000
FROM products p
JOIN (
    SELECT 'matte-black' AS finish_id, 'color.matteBlack'   AS finish_label_key,
           'Onyx AR'      AS lens_label,    'Onyx AR'      AS lens_label_en, '黑玛瑙增透膜'   AS lens_label_zh,
           'fit.urbanContrast' AS fit_label_key, '#111827' AS frame_color, '#5eead4' AS lens_color
    UNION ALL
    SELECT 'titanium',    'color.titanium',
           'Neutral Clear', 'Neutral Clear', '自然高清无色',
           'fit.studioNeutral', '#94a3b8', '#dbeafe'
    UNION ALL
    SELECT 'rose-gold',   'color.roseGold',
           'Warm HEV',     'Warm HEV',     '暖色防蓝光',
           'fit.softDaylight',  '#fb7185', '#fed7aa'
) t
WHERE p.name_en = 'AERO X1';
