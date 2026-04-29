CREATE TABLE IF NOT EXISTS users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    created_at DATETIME NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_users_email UNIQUE (email)
);

CREATE TABLE IF NOT EXISTS products (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    material VARCHAR(120) NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    image_url VARCHAR(1024) NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS lens_options (
    id BIGINT NOT NULL AUTO_INCREMENT,
    type VARCHAR(80) NOT NULL,
    index_value DECIMAL(6, 2) NOT NULL,
    additional_price DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS prescriptions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    user_email VARCHAR(255) NOT NULL,
    sph_od DECIMAL(6, 2) NOT NULL,
    sph_os DECIMAL(6, 2) NOT NULL,
    cyl_od DECIMAL(6, 2) NOT NULL,
    cyl_os DECIMAL(6, 2) NOT NULL,
    axis_od SMALLINT NOT NULL,
    axis_os SMALLINT NOT NULL,
    pd DECIMAL(6, 2) NOT NULL,
    user_id BIGINT NULL,
    PRIMARY KEY (id),
    CONSTRAINT chk_prescriptions_axis_od CHECK (axis_od BETWEEN 0 AND 180),
    CONSTRAINT chk_prescriptions_axis_os CHECK (axis_os BETWEEN 0 AND 180),
    CONSTRAINT fk_prescriptions_user FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS orders (
    id BIGINT NOT NULL AUTO_INCREMENT,
    order_number VARCHAR(64) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(32) NOT NULL,
    user_id BIGINT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_orders_order_number UNIQUE (order_number),
    CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id)
);
