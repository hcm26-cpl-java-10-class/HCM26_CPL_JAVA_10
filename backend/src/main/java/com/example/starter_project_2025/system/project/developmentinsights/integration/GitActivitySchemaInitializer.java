package com.example.starter_project_2025.system.project.developmentinsights.integration;

import java.sql.Connection;
import java.sql.Statement;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.springframework.stereotype.Component;

/** Supports the existing local ddl-auto=none setting. Only Git-owned schema is touched. */
@Component
@Order(Integer.MIN_VALUE)
@RequiredArgsConstructor
public class GitActivitySchemaInitializer implements ApplicationRunner {
    private final DataSource dataSource;

    @Override public void run(ApplicationArguments args) throws Exception {
        try (Connection connection = dataSource.getConnection(); Statement sql = connection.createStatement()) {
            if (!"H2".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName())) return;
            // Existing Dev B fixtures predate the source associations.
            if (tableExists(connection, "GIT_REPOSITORY")) {
                sql.execute("ALTER TABLE git_repository ADD COLUMN IF NOT EXISTS source_repository_id BIGINT");
            }
            if (tableExists(connection, "GIT_CONTRIBUTOR")) {
                sql.execute("ALTER TABLE git_contributor ADD COLUMN IF NOT EXISTS source_contributor_id BIGINT");
                sql.execute("ALTER TABLE git_contributor ADD COLUMN IF NOT EXISTS source_identity_key VARCHAR(320)");
                sql.execute("ALTER TABLE git_contributor ALTER COLUMN external_id DROP NOT NULL");
            }
            if (tableExists(connection, "PULL_REQUEST_REVIEW")) {
                sql.execute("ALTER TABLE pull_request_review ALTER COLUMN submitted_at DROP NOT NULL");
            }
            if (tableExists(connection, "GIT_COMMIT")) {
                sql.execute("ALTER TABLE git_commit ADD COLUMN IF NOT EXISTS source_ingested_at TIMESTAMP WITH TIME ZONE");
            }
            if (tableExists(connection, "COMMIT_VALIDATION_RESULT")) {
                sql.execute("ALTER TABLE commit_validation_result ADD COLUMN IF NOT EXISTS evaluation_key VARCHAR(48) DEFAULT 'INGESTION' NOT NULL");
                sql.execute("ALTER TABLE commit_validation_result ADD COLUMN IF NOT EXISTS rule_snapshot CLOB");
                sql.execute("ALTER TABLE commit_validation_result DROP CONSTRAINT IF EXISTS uk_git_validation_commit_rule_version");
            }
            ScriptUtils.executeSqlScript(connection, new ClassPathResource("db/migration/git-activity-integration-h2.sql"));
            migrateTaskKeys(connection, sql);
            sql.execute("ALTER TABLE git_pull_requests ADD COLUMN IF NOT EXISTS task_mapping_fingerprint VARCHAR(64)");
            sql.execute("ALTER TABLE pull_request ALTER COLUMN source_branch VARCHAR(255) NOT NULL");
            sql.execute("ALTER TABLE pull_request ALTER COLUMN target_branch VARCHAR(255) NOT NULL");
            sql.execute("ALTER TABLE git_pull_request_reviews DROP CONSTRAINT IF EXISTS uk_git_review_repo_external");
            sql.execute("CREATE UNIQUE INDEX IF NOT EXISTS uk_git_review_pr_external ON git_pull_request_reviews(pull_request_id, external_id)");
            sql.execute("CREATE UNIQUE INDEX IF NOT EXISTS uk_activity_source_repository ON git_repository(source_repository_id)");
            sql.execute("CREATE UNIQUE INDEX IF NOT EXISTS uk_activity_source_identity ON git_contributor(root_project_id, source_identity_key)");
        }
    }

    /** Copies Dev A keys/counters without modifying the original task schema or rows. */
    private void migrateTaskKeys(Connection connection, Statement sql) throws Exception {
        if (columnExists(connection, "SPRINT_BACKLOG", "TASK_KEY")
                && columnExists(connection, "SPRINT_BACKLOG", "TENANT_ID")
                && columnExists(connection, "SPRINT_BACKLOG", "TASK_KEY_NUMBER")) {
            sql.execute("""
                    MERGE INTO git_backlog_task_key target
                    USING (SELECT sprint_backlog_id, tenant_id, task_key, task_key_number FROM sprint_backlog
                            WHERE task_key IS NOT NULL AND task_key <> '' AND tenant_id IS NOT NULL) source
                       ON target.sprint_backlog_id = source.sprint_backlog_id
                    WHEN MATCHED AND target.task_key IS NULL THEN UPDATE SET tenant_id=source.tenant_id,
                         task_key=source.task_key, task_key_number=source.task_key_number
                    WHEN NOT MATCHED THEN INSERT(sprint_backlog_id,tenant_id,task_key,task_key_number)
                         VALUES(source.sprint_backlog_id,source.tenant_id,source.task_key,source.task_key_number)
                    """);
        }
        record Namespace(Long tenant, String prefix) { }
        var highWater = new java.util.LinkedHashMap<Namespace, Long>();
        if (tableExists(connection, "BACKLOG_TASK_KEY_SEQUENCE")) {
            try (var rows = sql.executeQuery("SELECT tenant_id,prefix,next_number FROM backlog_task_key_sequence")) {
                while (rows.next()) highWater.merge(new Namespace(rows.getLong(1), rows.getString(2)), rows.getLong(3), Math::max);
            }
        }
        try (var rows = sql.executeQuery("SELECT tenant_id,task_key FROM git_backlog_task_key WHERE tenant_id IS NOT NULL AND task_key IS NOT NULL")) {
            while (rows.next()) {
                String key = rows.getString(2);
                int separator = key.lastIndexOf('-');
                if (separator < 1 || separator > 8) continue;
                try {
                    long next = Math.addExact(Long.parseLong(key.substring(separator + 1)), 1);
                    highWater.merge(new Namespace(rows.getLong(1), key.substring(0, separator)), next, Math::max);
                } catch (NumberFormatException | ArithmeticException ignored) { /* Keep malformed historical keys unchanged. */ }
            }
        }
        try (var merge = connection.prepareStatement("""
                MERGE INTO git_task_key_sequence target
                USING (VALUES(CAST(? AS BIGINT),CAST(? AS VARCHAR(8)),CAST(? AS BIGINT))) source(tenant_id,prefix,next_number)
                   ON target.tenant_id=source.tenant_id AND target.prefix=source.prefix
                WHEN MATCHED AND target.next_number < source.next_number THEN UPDATE
                     SET next_number=source.next_number, updated_at=CURRENT_TIMESTAMP
                WHEN NOT MATCHED THEN INSERT(tenant_id,prefix,next_number,updated_at)
                     VALUES(source.tenant_id,source.prefix,source.next_number,CURRENT_TIMESTAMP)
                """)) {
            for (var entry : highWater.entrySet()) {
                merge.setLong(1, entry.getKey().tenant()); merge.setString(2, entry.getKey().prefix()); merge.setLong(3, entry.getValue());
                merge.addBatch();
            }
            merge.executeBatch();
        }
    }

    private boolean columnExists(Connection connection, String table, String column) throws Exception {
        try (var columns = connection.getMetaData().getColumns(null, connection.getSchema(), table, column)) {
            return columns.next();
        }
    }

    private boolean tableExists(Connection connection, String name) throws Exception {
        try (var tables = connection.getMetaData().getTables(null, connection.getSchema(), name, new String[]{"TABLE"})) {
            return tables.next();
        }
    }
}
