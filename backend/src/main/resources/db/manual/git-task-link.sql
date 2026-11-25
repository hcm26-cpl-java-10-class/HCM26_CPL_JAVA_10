-- US-SY-05 (mysql): Task IDs found in commits / pull requests (backlog_reference) and the N-N links
-- between tasks and commits / pull requests (backlog_git_link). Additive only; no foreign keys, like the
-- other Git tables. Existing commits are processed by GitTaskLinkSweeper after deployment.
-- Requires the SY-05 step 0 script (sprint_backlog.task_key). Local development uses ddl-auto=update.

CREATE TABLE IF NOT EXISTS backlog_reference (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    is_active BOOLEAN NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by BIGINT,
    updated_by BIGINT,
    tenant_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    repository_id BIGINT NOT NULL,
    source_type VARCHAR(20) NOT NULL,
    source_id BIGINT NOT NULL,
    source_field VARCHAR(10) NOT NULL,
    ref_key VARCHAR(30) NOT NULL,
    raw_text VARCHAR(40),
    backlog_item_id BIGINT,
    status VARCHAR(20) NOT NULL,
    reason VARCHAR(30) NOT NULL,
    resolved_at DATETIME(6) NOT NULL,
    CONSTRAINT uk_backlog_ref_source_key UNIQUE (source_type, source_id, ref_key)
);
CREATE INDEX idx_backlog_ref_project_status ON backlog_reference (project_id, status);
CREATE INDEX idx_backlog_ref_repo_source ON backlog_reference (repository_id, source_type, source_id);
CREATE INDEX idx_backlog_ref_item ON backlog_reference (backlog_item_id);

CREATE TABLE IF NOT EXISTS backlog_git_link (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    is_active BOOLEAN NOT NULL,
    created_at DATETIME(6) NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    created_by BIGINT,
    updated_by BIGINT,
    tenant_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    repository_id BIGINT NOT NULL,
    backlog_item_id BIGINT NOT NULL,
    item_project_id BIGINT,
    artifact_type VARCHAR(20) NOT NULL,
    artifact_id BIGINT NOT NULL,
    artifact_at DATETIME(6) NOT NULL,
    link_source VARCHAR(10) NOT NULL,
    reference_id BIGINT,
    linked_by_user_id BIGINT,
    linked_at DATETIME(6) NOT NULL,
    CONSTRAINT uk_backlog_git_link UNIQUE (backlog_item_id, artifact_type, artifact_id)
);
CREATE INDEX idx_bgl_item_time ON backlog_git_link (backlog_item_id, artifact_type, artifact_at);
CREATE INDEX idx_bgl_artifact ON backlog_git_link (artifact_type, artifact_id);
CREATE INDEX idx_bgl_project ON backlog_git_link (project_id, artifact_type);
CREATE INDEX idx_bgl_reference ON backlog_git_link (reference_id);
