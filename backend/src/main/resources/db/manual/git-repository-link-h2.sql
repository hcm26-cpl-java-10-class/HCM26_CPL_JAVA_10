-- US-GI-03/04 additive deployment script for H2. No existing data is updated; safe to run twice.
-- Local development uses Hibernate ddl-auto=update, which creates these objects itself.
-- If git_repositories already exists without the GI-04 columns, add them first:
--   ALTER TABLE git_repositories ADD COLUMN IF NOT EXISTS active_project_id BIGINT;
--   ALTER TABLE git_repositories ADD COLUMN IF NOT EXISTS active_external_id BIGINT;
--   UPDATE git_repositories SET active_project_id = project_id, active_external_id = external_id WHERE status = 'ACTIVE';
--   ALTER TABLE git_repositories ADD CONSTRAINT IF NOT EXISTS uk_git_repo_active_project UNIQUE (active_project_id);
--   ALTER TABLE git_repositories ADD CONSTRAINT IF NOT EXISTS uk_git_repo_active_external UNIQUE (provider, active_external_id);
CREATE TABLE IF NOT EXISTS git_repositories (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT,
    updated_by BIGINT,
    tenant_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    installation_ref BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    external_id BIGINT NOT NULL,
    owner_login VARCHAR(100) NOT NULL,
    name VARCHAR(100) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    html_url VARCHAR(500) NOT NULL,
    visibility VARCHAR(20) NOT NULL,
    default_branch VARCHAR(100),
    status VARCHAR(20) NOT NULL,
    linked_by_user_id BIGINT NOT NULL,
    linked_at TIMESTAMP(6) NOT NULL,
    unlinked_by_user_id BIGINT,
    unlinked_at TIMESTAMP(6),
    last_synced_at TIMESTAMP(6),
    -- GI-04: equal to project_id / external_id only while status = 'ACTIVE', NULL otherwise.
    active_project_id BIGINT,
    active_external_id BIGINT,
    version BIGINT,
    CONSTRAINT uk_git_repo_active_project UNIQUE (active_project_id),
    CONSTRAINT uk_git_repo_active_external UNIQUE (provider, active_external_id)
);
CREATE INDEX IF NOT EXISTS idx_git_repo_provider_external_status ON git_repositories (provider, external_id, status);
CREATE INDEX IF NOT EXISTS idx_git_repo_project ON git_repositories (project_id, status);
CREATE INDEX IF NOT EXISTS idx_git_repo_installation ON git_repositories (installation_ref, status);

CREATE TABLE IF NOT EXISTS git_sync_jobs (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT,
    updated_by BIGINT,
    tenant_id BIGINT NOT NULL,
    repository_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL,
    dedupe_key VARCHAR(100),
    attempt_count INT NOT NULL,
    max_attempts INT NOT NULL,
    next_run_at TIMESTAMP(6) NOT NULL,
    requested_by_user_id BIGINT,
    started_at TIMESTAMP(6),
    finished_at TIMESTAMP(6),
    error_code VARCHAR(50),
    error_message VARCHAR(500),
    stats_json CLOB,
    version BIGINT,
    CONSTRAINT uk_git_sync_dedupe UNIQUE (dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_git_sync_due ON git_sync_jobs (status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_git_sync_repository ON git_sync_jobs (repository_id, id);
