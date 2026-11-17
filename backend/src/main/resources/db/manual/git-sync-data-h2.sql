-- US-SY-04 additive deployment script for H2: commits, pull requests and reviews synchronized from
-- GitHub webhooks. No existing data is updated; safe to run twice. Local development uses ddl-auto=update.
-- git_webhook_events.status (ENUM -> VARCHAR, FAILED/DEAD renamed) is upgraded at startup by
-- GitWebhookStatusMigration; nothing to run by hand for it.

CREATE TABLE IF NOT EXISTS git_commits (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT,
    updated_by BIGINT,
    tenant_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    repository_id BIGINT NOT NULL,
    repo_external_id BIGINT NOT NULL,
    sha VARCHAR(64) NOT NULL,
    message VARCHAR(4000),
    author_name VARCHAR(255),
    author_email VARCHAR(255),
    author_login VARCHAR(100),
    author_github_id BIGINT,
    committer_name VARCHAR(255),
    committer_email VARCHAR(255),
    committer_login VARCHAR(100),
    authored_at TIMESTAMP(6),
    committed_at TIMESTAMP(6) NOT NULL,
    html_url VARCHAR(500),
    first_seen_ref VARCHAR(255) NOT NULL,
    files_changed INT,
    parent_count INT,
    source VARCHAR(20) NOT NULL,
    ingested_event_id BIGINT NOT NULL,
    ingested_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_git_commit_repo_sha UNIQUE (repository_id, sha)
);
CREATE INDEX IF NOT EXISTS idx_git_commit_project_time ON git_commits (project_id, committed_at);
CREATE INDEX IF NOT EXISTS idx_git_commit_repo_time ON git_commits (repository_id, committed_at);
CREATE INDEX IF NOT EXISTS idx_git_commit_repo_author ON git_commits (repository_id, author_login, committed_at);

CREATE TABLE IF NOT EXISTS git_pull_requests (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT,
    updated_by BIGINT,
    tenant_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    repository_id BIGINT NOT NULL,
    repo_external_id BIGINT NOT NULL,
    external_id BIGINT NOT NULL,
    number INT NOT NULL,
    title VARCHAR(500) NOT NULL,
    body VARCHAR(4000),
    state VARCHAR(20) NOT NULL,
    draft BOOLEAN NOT NULL,
    author_login VARCHAR(100),
    author_github_id BIGINT,
    head_ref VARCHAR(255),
    head_sha VARCHAR(64),
    base_ref VARCHAR(255),
    merge_commit_sha VARCHAR(64),
    merged_by_login VARCHAR(100),
    commits_count INT,
    additions INT,
    deletions INT,
    changed_files INT,
    html_url VARCHAR(500),
    github_created_at TIMESTAMP(6) NOT NULL,
    github_updated_at TIMESTAMP(6) NOT NULL,
    closed_at TIMESTAMP(6),
    merged_at TIMESTAMP(6),
    last_action VARCHAR(50),
    last_event_id BIGINT,
    version BIGINT,
    CONSTRAINT uk_git_pr_repo_number UNIQUE (repository_id, number)
);
CREATE INDEX IF NOT EXISTS idx_git_pr_project_state ON git_pull_requests (project_id, state, github_updated_at);
CREATE INDEX IF NOT EXISTS idx_git_pr_repo_state ON git_pull_requests (repository_id, state, github_updated_at);
CREATE INDEX IF NOT EXISTS idx_git_pr_repo_author ON git_pull_requests (repository_id, author_login);

CREATE TABLE IF NOT EXISTS git_pull_request_reviews (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT,
    updated_by BIGINT,
    tenant_id BIGINT NOT NULL,
    project_id BIGINT NOT NULL,
    repository_id BIGINT NOT NULL,
    pull_request_id BIGINT NOT NULL,
    external_id BIGINT NOT NULL,
    reviewer_login VARCHAR(100),
    reviewer_github_id BIGINT,
    state VARCHAR(20) NOT NULL,
    body VARCHAR(4000),
    commit_sha VARCHAR(64),
    submitted_at TIMESTAMP(6),
    dismissed_at TIMESTAMP(6),
    html_url VARCHAR(500),
    source_updated_at TIMESTAMP(6) NOT NULL,
    source_action_rank INT NOT NULL,
    last_action VARCHAR(50),
    last_event_id BIGINT,
    version BIGINT,
    CONSTRAINT uk_git_review_repo_external UNIQUE (repository_id, external_id),
    CONSTRAINT fk_git_review_pull_request FOREIGN KEY (pull_request_id) REFERENCES git_pull_requests (id)
);
CREATE INDEX IF NOT EXISTS idx_git_review_pr ON git_pull_request_reviews (pull_request_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_git_review_project_reviewer ON git_pull_request_reviews (project_id, reviewer_login, submitted_at);
