-- V11__apply_schema_constraints_and_nullability.sql
-- DDL changes moved out of V8 so that V8 remains fully idempotent
-- (V8 now only contains INSERT IGNORE and UPDATE statements).
--
-- This migration is NEW and runs exactly ONCE per database, so
-- non-idempotent DDL is safe here.

-- 1. Make legacy name/material columns nullable
--    (they are redundant with the localised name_en/material_en columns).
--    Re-running MODIFY COLUMN on an already-nullable column is a safe no-op.
ALTER TABLE products MODIFY name VARCHAR(120) NULL;
ALTER TABLE products MODIFY material VARCHAR(120) NULL;

-- 2. Add unique constraint on (product_id, finish_id) for product_ar_configs.
--    We use a stored procedure to check if the index already exists,
--    making this migration idempotent on persistent databases.
DROP PROCEDURE IF EXISTS AddUniqueConstraint;
DELIMITER //
CREATE PROCEDURE AddUniqueConstraint()
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
END //
DELIMITER ;
CALL AddUniqueConstraint();
DROP PROCEDURE AddUniqueConstraint;
