-- US-GI-05 deployment script for H2: manage the linked repository (DISCONNECTED / ERROR, reason, unlink).
-- Safe to run twice. Local development uses ddl-auto=update. The status column and the former
-- UNAVAILABLE rows are upgraded at startup (GitTaskLinkEnumCheckMigration, GitRepositoryStatusMigration).

ALTER TABLE git_repositories ADD COLUMN IF NOT EXISTS status_reason VARCHAR(50);
ALTER TABLE git_repositories ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP(6);
