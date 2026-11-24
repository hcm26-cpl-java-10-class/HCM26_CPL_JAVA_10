-- US-GI-02 deployment script for MySQL 8: GitHub connection status (ERROR state, reason, recheck).
-- Local development uses ddl-auto=update. Run once (MySQL 8 has no ADD COLUMN IF NOT EXISTS).
-- An ENUM git_installations.status without ERROR is turned into VARCHAR at startup by
-- GitTaskLinkEnumCheckMigration; nothing to run by hand for it.

ALTER TABLE git_installations
    ADD COLUMN status_reason VARCHAR(50) NULL,
    ADD COLUMN status_changed_at DATETIME(6) NULL,
    ADD COLUMN last_checked_at DATETIME(6) NULL;
