-- US-GI-07 deployment script for H2: disconnect a GitHub account / organization. Safe to run twice.
-- Local development uses ddl-auto=update.

ALTER TABLE git_installations ADD COLUMN IF NOT EXISTS disconnected_by_user_id BIGINT;
