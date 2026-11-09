-- H2 counterpart: Instant uses TIMESTAMP WITH TIME ZONE with Hibernate's H2 dialect.
CREATE TABLE IF NOT EXISTS project_git_configs (
    workspace_id BIGINT NOT NULL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    team_id BIGINT NOT NULL,
    repository_url VARCHAR(2048),
    repository_web_url VARCHAR(2048),
    provider VARCHAR(32),
    default_branch VARCHAR(255),
    version BIGINT NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    created_by BIGINT NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_by BIGINT NOT NULL,
    CONSTRAINT fk_project_git_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);
