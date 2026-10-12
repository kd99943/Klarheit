-- V15__deduplicate_and_unique_lens_options.sql
-- Safely cleans up duplicate lens options and adds a UNIQUE constraint on the type column.

-- 1. Update references in order_lens_options to point to the canonical (minimum ID) lens option for each type
UPDATE IGNORE order_lens_options olo
JOIN lens_options lo_old ON olo.lens_option_id = lo_old.id
JOIN (
    SELECT type, MIN(id) as canonical_id 
    FROM lens_options 
    GROUP BY type
) lo_new ON lo_old.type = lo_new.type
SET olo.lens_option_id = lo_new.canonical_id
WHERE olo.lens_option_id != lo_new.canonical_id;

-- 2. Delete duplicate lens options, keeping only the one with the lowest ID for each type
DELETE l1 FROM lens_options l1
INNER JOIN lens_options l2 
WHERE l1.id > l2.id AND l1.type = l2.type;

-- 3. Add UNIQUE constraint on type
ALTER TABLE lens_options ADD CONSTRAINT uk_lens_options_type UNIQUE (type);
