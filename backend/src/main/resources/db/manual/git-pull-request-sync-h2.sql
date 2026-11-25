-- US-SY-02 deployment script for H2: pull requests and reviews synchronized through GraphQL.
-- Safe to run twice. Local development uses ddl-auto=update. The CHECK of git_sync_jobs.phase written
-- before PULL_REQUESTS existed is dropped at startup by GitTaskLinkEnumCheckMigration.

ALTER TABLE git_sync_jobs ADD COLUMN IF NOT EXISTS pr_cursor VARCHAR(255);
ALTER TABLE git_sync_jobs ADD COLUMN IF NOT EXISTS pr_since TIMESTAMP(6);
ALTER TABLE git_sync_jobs ADD COLUMN IF NOT EXISTS pr_pages_done INT;

ALTER TABLE git_repositories ADD COLUMN IF NOT EXISTS pull_requests_synced_at TIMESTAMP(6);

ALTER TABLE git_pull_requests ADD COLUMN IF NOT EXISTS last_sync_job_id BIGINT;

ALTER TABLE git_pull_request_reviews ADD COLUMN IF NOT EXISTS last_sync_job_id BIGINT;
