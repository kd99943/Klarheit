-- V9__deduplicate_products.sql
-- Safely merges duplicate products and updates orders before deleting redundant records.

-- 1. Update orders to point to the canonical product (maximum ID for each product name)
UPDATE orders 
SET product_id = (
    SELECT max_id FROM (
        SELECT MAX(id) as max_id FROM products WHERE name IN ('Aero X1', 'AERO X1')
    ) as temp
)
WHERE product_id IN (
    SELECT id FROM products WHERE name IN ('Aero X1', 'AERO X1')
);

UPDATE orders 
SET product_id = (
    SELECT max_id FROM (
        SELECT MAX(id) as max_id FROM products WHERE name IN ('Monolith 02', 'MONOLITH 02')
    ) as temp
)
WHERE product_id IN (
    SELECT id FROM products WHERE name IN ('Monolith 02', 'MONOLITH 02')
);

UPDATE orders 
SET product_id = (
    SELECT max_id FROM (
        SELECT MAX(id) as max_id FROM products WHERE name IN ('Orbit T-4', 'ORBIT T-4')
    ) as temp
)
WHERE product_id IN (
    SELECT id FROM products WHERE name IN ('Orbit T-4', 'ORBIT T-4')
);

UPDATE orders 
SET product_id = (
    SELECT max_id FROM (
        SELECT MAX(id) as max_id FROM products WHERE name IN ('Lucent V1', 'LUCENT V1')
    ) as temp
)
WHERE product_id IN (
    SELECT id FROM products WHERE name IN ('Lucent V1', 'LUCENT V1')
);

-- 2. Delete duplicate products (keeping only the one with the maximum ID for each name)
DELETE FROM products 
WHERE id NOT IN (
    SELECT max_id FROM (
        SELECT MAX(id) as max_id FROM products GROUP BY name
    ) as temp
);
