-- US-GI-05 deployment script for MySQL 8: manage the linked repository (DISCONNECTED / ERROR, reason, unlink).
-- Local development uses ddl-auto=update. Run once (MySQL 8 has no ADD COLUMN IF NOT EXISTS).
-- At startup GitTaskLinkEnumCheckMigration turns an ENUM git_repositories.status without DISCONNECTED /
-- ERROR into VARCHAR, and GitRepositoryStatusMigration converts the former UNAVAILABLE rows
-- (DISCONNECTED, or INACTIVE when the master already has another repository). Nothing else to run by hand.

ALTER TABLE git_repositories
    ADD COLUMN status_reason VARCHAR(50) NULL,
    ADD COLUMN status_changed_at DATETIME(6) NULL;
