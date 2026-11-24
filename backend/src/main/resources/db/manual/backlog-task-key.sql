-- SY-05 step 0 (MySQL): Task ID of backlog items (sprint_backlog.task_key, e.g. FA-12) and its counter.
-- Additive only. Existing rows get their key at startup from BacklogTaskKeyMigration (keeps PREFIX-id);
-- workspaces without task_key_prefix get one there too. Local development uses ddl-auto=update.

ALTER TABLE sprint_backlog ADD COLUMN tenant_id BIGINT NULL;
ALTER TABLE sprint_backlog ADD COLUMN task_key VARCHAR(20) NULL;
ALTER TABLE sprint_backlog ADD COLUMN task_key_number BIGINT NULL;
ALTER TABLE sprint_backlog ADD CONSTRAINT uk_sprint_backlog_task_key UNIQUE (tenant_id, task_key);
CREATE INDEX idx_sprint_backlog_task_key ON sprint_backlog (task_key);

CREATE TABLE IF NOT EXISTS backlog_task_key_sequence (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    prefix VARCHAR(8) NOT NULL,
    next_number BIGINT NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    CONSTRAINT uk_task_key_seq UNIQUE (tenant_id, prefix)
);
