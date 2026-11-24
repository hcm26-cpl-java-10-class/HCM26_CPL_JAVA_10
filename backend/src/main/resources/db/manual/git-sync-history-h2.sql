-- US-SY-06 deployment script for H2: synchronization history. Safe to run twice.
-- Local development uses ddl-auto=update.

ALTER TABLE git_sync_jobs ADD COLUMN IF NOT EXISTS resumed_from_job_id BIGINT;
ALTER TABLE git_webhook_events ADD COLUMN IF NOT EXISTS records_processed INT;
ALTER TABLE git_webhook_events ADD COLUMN IF NOT EXISTS partial_result BOOLEAN;
CREATE INDEX IF NOT EXISTS idx_git_webhook_repository_ref ON git_webhook_events (repository_ref, received_at);
