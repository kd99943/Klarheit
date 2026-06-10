ALTER TABLE products ADD COLUMN name_en VARCHAR(120) NULL;
ALTER TABLE products ADD COLUMN name_zh VARCHAR(120) NULL;
ALTER TABLE products ADD COLUMN material_en VARCHAR(120) NULL;
ALTER TABLE products ADD COLUMN material_zh VARCHAR(120) NULL;

ALTER TABLE product_ar_configs ADD COLUMN lens_label_en VARCHAR(120) NULL;
ALTER TABLE product_ar_configs ADD COLUMN lens_label_zh VARCHAR(120) NULL;

ALTER TABLE orders ADD COLUMN finish_id VARCHAR(64) NULL;

UPDATE products SET name_en = name, name_zh = name, material_en = material, material_zh = material;
UPDATE product_ar_configs SET lens_label_en = lens_label, lens_label_zh = lens_label;

ALTER TABLE products MODIFY name_en VARCHAR(120) NOT NULL;
ALTER TABLE products MODIFY name_zh VARCHAR(120) NOT NULL;
ALTER TABLE products MODIFY material_en VARCHAR(120) NOT NULL;
ALTER TABLE products MODIFY material_zh VARCHAR(120) NOT NULL;

ALTER TABLE product_ar_configs MODIFY lens_label_en VARCHAR(120) NOT NULL;
ALTER TABLE product_ar_configs MODIFY lens_label_zh VARCHAR(120) NOT NULL;
