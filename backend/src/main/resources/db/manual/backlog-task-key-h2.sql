-- Git-owned Task ID metadata; leaves the existing sprint_backlog schema and data unchanged.
-- Startup imports legacy keys/counters and backfills missing keys without changing task rows.
CREATE TABLE IF NOT EXISTS git_backlog_task_key (
    sprint_backlog_id BIGINT PRIMARY KEY,
    tenant_id BIGINT,
    task_key VARCHAR(20),
    task_key_number BIGINT,
    CONSTRAINT uk_git_backlog_task_key UNIQUE (tenant_id, task_key),
    CONSTRAINT fk_git_backlog_task_key_task FOREIGN KEY (sprint_backlog_id) REFERENCES sprint_backlog ON DELETE CASCADE,
    CONSTRAINT fk_git_backlog_task_key_tenant FOREIGN KEY (tenant_id) REFERENCES tenants
);
CREATE INDEX IF NOT EXISTS idx_git_backlog_task_key ON git_backlog_task_key(task_key);
CREATE TABLE IF NOT EXISTS git_task_key_sequence (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    prefix VARCHAR(8) NOT NULL,
    next_number BIGINT NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_git_task_key_sequence UNIQUE (tenant_id, prefix)
);
-- Reservations intentionally survive the caller's transaction; tenant may still be uncommitted.
ALTER TABLE git_task_key_sequence DROP CONSTRAINT IF EXISTS fk_git_task_key_sequence_tenant;
