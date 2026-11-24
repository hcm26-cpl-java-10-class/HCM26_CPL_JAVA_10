-- US-SY-01 deployment script for H2: commit history synchronization (GraphQL) and the periodic
-- reconcile. Safe to run twice. Local development uses ddl-auto=update. At startup,
-- GitCommitSyncColumnsMigration relaxes git_commits.ingested_event_id and backfills is_merge / is_bot,
-- and GitTaskLinkEnumCheckMigration turns an ENUM git_sync_jobs.status / type into VARCHAR.

ALTER TABLE git_sync_jobs ADD COLUMN IF NOT EXISTS phase VARCHAR(30);
ALTER TABLE git_sync_jobs ADD COLUMN IF NOT EXISTS commit_cursor VARCHAR(255);
ALTER TABLE git_sync_jobs ADD COLUMN IF NOT EXISTS commit_since TIMESTAMP(6);
ALTER TABLE git_sync_jobs ADD COLUMN IF NOT EXISTS commit_branch VARCHAR(255);
ALTER TABLE git_sync_jobs ADD COLUMN IF NOT EXISTS commit_head_oid VARCHAR(64);
ALTER TABLE git_sync_jobs ADD COLUMN IF NOT EXISTS pages_done INT;

ALTER TABLE git_repositories ADD COLUMN IF NOT EXISTS commit_history_synced_at TIMESTAMP(6);

ALTER TABLE git_commits ALTER COLUMN ingested_event_id SET NULL;
ALTER TABLE git_commits ADD COLUMN IF NOT EXISTS ingested_sync_job_id BIGINT;
ALTER TABLE git_commits ADD COLUMN IF NOT EXISTS is_merge BOOLEAN;
ALTER TABLE git_commits ADD COLUMN IF NOT EXISTS is_bot BOOLEAN;

CREATE TABLE IF NOT EXISTS shedlock (
    name VARCHAR(64) NOT NULL,
    lock_until TIMESTAMP(3) NOT NULL,
    locked_at TIMESTAMP(3) NOT NULL,
    locked_by VARCHAR(255) NOT NULL,
    PRIMARY KEY (name)
);
