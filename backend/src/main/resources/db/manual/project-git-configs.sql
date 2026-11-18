-- Additive deployment script for MySQL 8. No existing data is updated.
-- The application currently uses Hibernate ddl-auto=update locally; deployments
-- with ddl-auto=validate/none must apply this before deploying the Git module.
CREATE TABLE IF NOT EXISTS project_git_configs (
    workspace_id BIGINT NOT NULL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    team_id BIGINT NOT NULL,
    repository_url VARCHAR(2048),
    repository_web_url VARCHAR(2048),
    provider VARCHAR(32),
    default_branch VARCHAR(255),
    version BIGINT NOT NULL,
    created_at DATETIME(6) NOT NULL,
    created_by BIGINT NOT NULL,
    updated_at DATETIME(6) NOT NULL,
    updated_by BIGINT NOT NULL,
    CONSTRAINT fk_project_git_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);
