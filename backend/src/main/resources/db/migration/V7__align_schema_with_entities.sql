-- V7__align_schema_with_entities.sql
-- Aligns the database schema with current JPA entity definitions.

-- 1. Add category, label, description to lens_options so LensOptionService
--    no longer needs hardcoded switch statements.
ALTER TABLE lens_options ADD COLUMN category VARCHAR(32) NOT NULL DEFAULT 'OPTION';
ALTER TABLE lens_options ADD COLUMN label VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE lens_options ADD COLUMN description VARCHAR(512) NOT NULL DEFAULT '';

-- 2. Seed known lens option metadata
UPDATE lens_options SET category = 'LENS',    label = 'Custom Lenses (High-Index)', description = 'Thin 1.74 index lenses for stronger prescriptions.' WHERE type = 'HIGH_INDEX_174';
UPDATE lens_options SET category = 'COATING', label = 'Onyx AR Coating',            description = 'Premium anti-reflective coating for glare reduction.'   WHERE type = 'AR_ONYX';
UPDATE lens_options SET category = 'COATING', label = 'HEV Filter',                 description = 'Blue light filtering treatment for daily screen use.'   WHERE type = 'HEV_BLUE';
