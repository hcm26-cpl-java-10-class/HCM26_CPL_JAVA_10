-- US-TM-03: task <-> pull request pairs a user unlinked (automatic mapping does not link them again).
-- Dev uses ddl-auto=update; run this by hand only where the schema is managed manually.
-- New enum values: backlog_reference.status EXCLUDED, backlog_reference.reason UNLINKED_BY_USER,
-- backlog_reference.source_field MERGED_PR. The columns are VARCHAR, but Hibernate may have created
-- a CHECK (... IN (...)) without them: GitTaskLinkEnumCheckMigration drops such a check at start-up.

CREATE TABLE IF NOT EXISTS backlog_git_link_exclusion (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    is_active BOOLEAN NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    created_by BIGINT,
    updated_by BIGINT,
    tenant_id BIGINT NOT NULL,
    backlog_item_id BIGINT NOT NULL,
    artifact_type VARCHAR(20) NOT NULL,
    artifact_id BIGINT NOT NULL,
    excluded_by_user_id BIGINT NOT NULL,
    excluded_at TIMESTAMP(6) NOT NULL,
    CONSTRAINT uk_backlog_git_link_excl UNIQUE (backlog_item_id, artifact_type, artifact_id)
);
CREATE INDEX IF NOT EXISTS idx_backlog_git_link_excl_artifact ON backlog_git_link_exclusion (artifact_type, artifact_id);
