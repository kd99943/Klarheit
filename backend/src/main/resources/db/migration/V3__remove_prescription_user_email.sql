-- Normalize prescriptions table
ALTER TABLE prescriptions DROP COLUMN user_email;

-- Create join table order_lens_options
CREATE TABLE IF NOT EXISTS order_lens_options (
    order_id BIGINT NOT NULL,
    lens_option_id BIGINT NOT NULL,
    PRIMARY KEY (order_id, lens_option_id),
    CONSTRAINT fk_order_lens_options_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    CONSTRAINT fk_order_lens_options_option FOREIGN KEY (lens_option_id) REFERENCES lens_options (id) ON DELETE CASCADE
);

-- Add indexes on orders table
CREATE INDEX idx_orders_order_number ON orders (order_number);
CREATE INDEX idx_orders_user_id ON orders (user_id);

-- Drop redundant lens_option_types column from orders
ALTER TABLE orders DROP COLUMN lens_option_types;
