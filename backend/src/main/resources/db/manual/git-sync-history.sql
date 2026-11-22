-- US-SY-06 deployment script for MySQL 8: synchronization history.
-- Local development uses ddl-auto=update. Run once (MySQL 8 has no ADD COLUMN IF NOT EXISTS).
-- No data to convert: deliveries received before SY-06 show "—" as records processed.

ALTER TABLE git_sync_jobs
    ADD COLUMN resumed_from_job_id BIGINT NULL;

ALTER TABLE git_webhook_events
    ADD COLUMN records_processed INT NULL,
    ADD COLUMN partial_result BIT(1) NULL;

CREATE INDEX idx_git_webhook_repository_ref ON git_webhook_events (repository_ref, received_at);
