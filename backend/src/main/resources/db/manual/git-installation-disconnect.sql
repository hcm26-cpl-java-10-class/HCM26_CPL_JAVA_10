-- US-GI-07 deployment script for MySQL 8: disconnect a GitHub account / organization from the platform.
-- Local development uses ddl-auto=update. Run once (MySQL 8 has no ADD COLUMN IF NOT EXISTS).

ALTER TABLE git_installations
    ADD COLUMN disconnected_by_user_id BIGINT NULL;
