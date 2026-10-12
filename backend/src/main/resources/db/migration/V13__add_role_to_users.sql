-- V13__add_role_to_users.sql
-- Add role column to users table and seed a default admin user.

ALTER TABLE users ADD COLUMN role VARCHAR(30) NOT NULL DEFAULT 'USER';

-- Seed default admin user (email: admin@klarheit.com, password: admin (hashed), role: ADMIN)
INSERT IGNORE INTO users (email, password_hash, first_name, last_name, created_at, role)
VALUES ('admin@klarheit.com', '$2a$10$X5p.tP/e18S3hL2Nl6.5A.sH26v2Q2Uu6l824R52bLpE8K9k0L17G', 'Admin', 'User', '2026-06-25 00:00:00', 'ADMIN');
