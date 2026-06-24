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
--    This runs for the first time on every database (fresh or upgraded from V10),
--    so the constraint does not yet exist → ADD CONSTRAINT succeeds unconditionally.
ALTER TABLE product_ar_configs
    ADD CONSTRAINT uk_ar_configs_product_finish UNIQUE (product_id, finish_id);
