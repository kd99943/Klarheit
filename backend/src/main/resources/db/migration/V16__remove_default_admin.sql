-- V16__remove_default_admin.sql
-- Removes the default admin account originally seeded by V13
-- (email: admin@klarheit.com, plaintext password: "admin").
--
-- Rationale: V13 inserts this account with a known weak password, making it a
-- known-weak credential that could be used against any production deployment
-- that ran this migration. The local-profile-only ApplicationRunner bean in
-- DataInitializer re-creates the same dev admin on startup for local
-- development only, so removing it here is safe for dev workflows.

DELETE FROM users WHERE email = 'admin@klarheit.com';
