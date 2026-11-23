ALTER TABLE orders
    ADD COLUMN product_name_snapshot VARCHAR(120) NULL,
    ADD COLUMN product_image_url_snapshot VARCHAR(1024) NULL,
    ADD COLUMN lens_options_snapshot JSON NULL;

UPDATE orders o
LEFT JOIN products p ON p.id = o.product_id
SET o.product_name_snapshot = p.name,
    o.product_image_url_snapshot = p.image_url,
    o.lens_options_snapshot = (
        SELECT JSON_ARRAYAGG(JSON_OBJECT(
            'type', lo.type,
            'label', lo.label,
            'additionalPrice', lo.additional_price
        ))
        FROM order_lens_options olo
        JOIN lens_options lo ON lo.id = olo.lens_option_id
        WHERE olo.order_id = o.id
    );

UPDATE orders
SET lens_options_snapshot = JSON_ARRAY()
WHERE lens_options_snapshot IS NULL;
