-- US-SY-02 deployment script for MySQL 8: pull requests and reviews synchronized through GraphQL.
-- Local development uses ddl-auto=update. Run once (MySQL 8 has no ADD COLUMN IF NOT EXISTS).
-- The CHECK of git_sync_jobs.phase written before PULL_REQUESTS existed is dropped at startup by
-- GitTaskLinkEnumCheckMigration; nothing to run by hand for it.

ALTER TABLE git_sync_jobs
    ADD COLUMN pr_cursor VARCHAR(255) NULL,
    ADD COLUMN pr_since DATETIME(6) NULL,
    ADD COLUMN pr_pages_done INT NULL;

ALTER TABLE git_repositories
    ADD COLUMN pull_requests_synced_at DATETIME(6) NULL;

ALTER TABLE git_pull_requests
    ADD COLUMN last_sync_job_id BIGINT NULL;

ALTER TABLE git_pull_request_reviews
    ADD COLUMN last_sync_job_id BIGINT NULL;
