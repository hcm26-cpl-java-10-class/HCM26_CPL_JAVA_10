-- US-SY-03 additive deployment script for H2. No existing data is updated; safe to run twice.
-- Local development uses Hibernate ddl-auto=update, which creates this table itself.
CREATE TABLE IF NOT EXISTS git_webhook_events (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT,
    updated_by BIGINT,
    provider VARCHAR(20) NOT NULL,
    delivery_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    action VARCHAR(50),
    hook_id BIGINT,
    installation_id BIGINT,
    repo_external_id BIGINT,
    repo_full_name VARCHAR(200),
    sender_login VARCHAR(100),
    tenant_id BIGINT,
    installation_ref BIGINT,
    repository_ref BIGINT,
    payload CLOB,
    payload_bytes INT NOT NULL,
    payload_purged_at TIMESTAMP(6),
    status VARCHAR(20) NOT NULL,
    attempts INT NOT NULL,
    next_attempt_at TIMESTAMP(6) NOT NULL,
    last_error VARCHAR(1000),
    received_at TIMESTAMP(6) NOT NULL,
    processing_started_at TIMESTAMP(6),
    processed_at TIMESTAMP(6),
    version BIGINT,
    CONSTRAINT uk_git_webhook_delivery UNIQUE (provider, delivery_id)
);
CREATE INDEX IF NOT EXISTS idx_git_webhook_due ON git_webhook_events (status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_git_webhook_installation ON git_webhook_events (installation_id, received_at);
CREATE INDEX IF NOT EXISTS idx_git_webhook_repository ON git_webhook_events (repo_external_id, received_at);
CREATE INDEX IF NOT EXISTS idx_git_webhook_received ON git_webhook_events (received_at);
