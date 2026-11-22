-- US-GI-02 deployment script for H2: GitHub connection status (ERROR state, reason, recheck).
-- Safe to run twice. Local development uses ddl-auto=update. An ENUM git_installations.status without
-- ERROR is turned into VARCHAR at startup by GitTaskLinkEnumCheckMigration.

ALTER TABLE git_installations ADD COLUMN IF NOT EXISTS status_reason VARCHAR(50);
ALTER TABLE git_installations ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP(6);
ALTER TABLE git_installations ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP(6);
