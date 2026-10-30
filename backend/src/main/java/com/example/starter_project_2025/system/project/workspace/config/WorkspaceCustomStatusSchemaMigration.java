package com.example.starter_project_2025.system.project.workspace.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.DatabaseMetaData;

/**
 * Older local H2 databases created SprintBacklogStatus as a native ENUM.
 * Custom workflow statuses are added over time, so keep the persisted status
 * column extensible while preserving all existing values.
 */
@Slf4j
@Component
@Order(19)
@RequiredArgsConstructor
public class WorkspaceCustomStatusSchemaMigration implements CommandLineRunner {
    private final DataSource dataSource;
    private final JdbcTemplate jdbc;

    @Override
    public void run(String... args) throws Exception {
        try (var connection = dataSource.getConnection()) {
            DatabaseMetaData metadata = connection.getMetaData();
            if (!"H2".equalsIgnoreCase(metadata.getDatabaseProductName())) return;

            String table = metadata.storesUpperCaseIdentifiers() ? "SPRINT_BACKLOG" : "sprint_backlog";
            String column = metadata.storesUpperCaseIdentifiers() ? "STATUS" : "status";
            try (var columns = metadata.getColumns(connection.getCatalog(), connection.getSchema(), table, column)) {
                if (!columns.next()) return;
                String typeName = columns.getString("TYPE_NAME");
                if (typeName == null || !typeName.toUpperCase(java.util.Locale.ROOT).startsWith("ENUM")) return;
            }

            jdbc.execute("ALTER TABLE sprint_backlog ALTER COLUMN status VARCHAR(20)");
            log.info("Migrated legacy H2 sprint_backlog.status from ENUM to VARCHAR(20) for custom workflow statuses");
        }
    }
}
