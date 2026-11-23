-- Preserve the old normalized assets; NULL lets the frontend identify bundled legacy materials.
ALTER TABLE product_ar_configs
    ADD COLUMN model_scale_mode VARCHAR(16) NOT NULL DEFAULT 'normalized',
    ADD COLUMN legacy_materials BOOLEAN NULL,
    ADD CONSTRAINT chk_ar_model_scale_mode CHECK (model_scale_mode IN ('normalized', 'real-meters'));
