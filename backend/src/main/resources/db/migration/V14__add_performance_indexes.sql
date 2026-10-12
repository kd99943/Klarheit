-- V14: Add Performance Indexes for query optimization

-- orders table
CREATE INDEX idx_orders_user_id_created_at ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status_created_at ON orders(status, created_at);

-- coupons table
CREATE INDEX idx_coupons_code ON coupons(code);

-- addresses table
CREATE INDEX idx_addresses_user_id_default ON addresses(user_id, is_default DESC, created_at DESC);
