-- US-SY-01 deployment script for MySQL 8: commit history synchronization (GraphQL) and the periodic
-- reconcile. Local development uses ddl-auto=update. Run the ALTER statements once (MySQL 8 has no
-- ADD COLUMN IF NOT EXISTS). At startup, GitCommitSyncColumnsMigration relaxes
-- git_commits.ingested_event_id and backfills is_merge / is_bot, and GitTaskLinkEnumCheckMigration
-- turns an ENUM git_sync_jobs.status / type into VARCHAR; nothing to run by hand for those.

ALTER TABLE git_sync_jobs
    ADD COLUMN phase VARCHAR(30) NULL,
    ADD COLUMN commit_cursor VARCHAR(255) NULL,
    ADD COLUMN commit_since DATETIME(6) NULL,
    ADD COLUMN commit_branch VARCHAR(255) NULL,
    ADD COLUMN commit_head_oid VARCHAR(64) NULL,
    ADD COLUMN pages_done INT NULL;

ALTER TABLE git_repositories
    ADD COLUMN commit_history_synced_at DATETIME(6) NULL;

ALTER TABLE git_commits
    MODIFY COLUMN ingested_event_id BIGINT NULL,
    ADD COLUMN ingested_sync_job_id BIGINT NULL,
    ADD COLUMN is_merge BOOLEAN NULL,
    ADD COLUMN is_bot BOOLEAN NULL;

CREATE TABLE IF NOT EXISTS shedlock (
    name VARCHAR(64) NOT NULL,
    lock_until TIMESTAMP(3) NOT NULL,
    locked_at TIMESTAMP(3) NOT NULL,
    locked_by VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
);
