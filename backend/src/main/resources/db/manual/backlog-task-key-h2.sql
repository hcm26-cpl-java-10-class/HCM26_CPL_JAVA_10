-- SY-05 step 0 (H2): Task ID of backlog items (sprint_backlog.task_key, e.g. FA-12) and its counter.
-- Additive only, safe to run twice. Existing rows get their key at startup from BacklogTaskKeyMigration.

ALTER TABLE sprint_backlog ADD COLUMN IF NOT EXISTS tenant_id BIGINT;
ALTER TABLE sprint_backlog ADD COLUMN IF NOT EXISTS task_key VARCHAR(20);
ALTER TABLE sprint_backlog ADD COLUMN IF NOT EXISTS task_key_number BIGINT;
ALTER TABLE sprint_backlog ADD CONSTRAINT IF NOT EXISTS uk_sprint_backlog_task_key UNIQUE (tenant_id, task_key);
CREATE INDEX IF NOT EXISTS idx_sprint_backlog_task_key ON sprint_backlog (task_key);

CREATE TABLE IF NOT EXISTS backlog_task_key_sequence (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    prefix VARCHAR(8) NOT NULL,
    next_number BIGINT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_task_key_seq UNIQUE (tenant_id, prefix)
);
