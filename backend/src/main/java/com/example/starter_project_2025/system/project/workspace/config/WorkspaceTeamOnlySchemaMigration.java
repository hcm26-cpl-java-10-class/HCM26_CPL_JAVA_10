package com.example.starter_project_2025.system.project.workspace.config;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Keeps local databases created before Team-only workspaces compatible with
 * the nullable project relationship.
 */
@Component
@RequiredArgsConstructor
public class WorkspaceTeamOnlySchemaMigration {
    private final JdbcTemplate jdbc;

    @jakarta.annotation.PostConstruct
    public void migrate() {
        jdbc.execute("ALTER TABLE workspaces ALTER COLUMN project_id BIGINT NULL");
        jdbc.execute("ALTER TABLE workspace_audits ALTER COLUMN project_id BIGINT NULL");
        jdbc.execute("ALTER TABLE milestones ALTER COLUMN project_id BIGINT NULL");
        jdbc.execute("ALTER TABLE milestone_audit_logs ALTER COLUMN project_id BIGINT NULL");
    }
}
