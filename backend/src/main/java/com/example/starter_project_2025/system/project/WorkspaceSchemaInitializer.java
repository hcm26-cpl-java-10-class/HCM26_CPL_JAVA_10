package com.example.starter_project_2025.system.project;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.sql.DatabaseMetaData;

/** Hibernate update does not relax an existing NOT NULL foreign key. */
@Component
@Order(18)
@RequiredArgsConstructor
public class WorkspaceSchemaInitializer implements CommandLineRunner {
    private final DataSource dataSource;

    @Override
    public void run(String... args) throws Exception {
        try (var connection = dataSource.getConnection()) {
            var metadata = connection.getMetaData();
            boolean upper = metadata.storesUpperCaseIdentifiers();
            try (var columns = metadata.getColumns(connection.getCatalog(), connection.getSchema(),
                    upper ? "TEAMS" : "teams", upper ? "PROJECT_ID" : "project_id")) {
                if (!columns.next() || columns.getInt("NULLABLE") != DatabaseMetaData.columnNoNulls) return;
            }
            String product = metadata.getDatabaseProductName();
            String statement = switch (product) {
                case "H2", "PostgreSQL" -> "ALTER TABLE teams ALTER COLUMN project_id DROP NOT NULL";
                case "MySQL", "MariaDB" -> "ALTER TABLE teams MODIFY COLUMN project_id BIGINT NULL";
                default -> throw new IllegalStateException("Allow NULL in teams.project_id before starting Workspace on " + product);
            };
            try (var migration = connection.createStatement()) { migration.execute(statement); }
        }
    }
}
