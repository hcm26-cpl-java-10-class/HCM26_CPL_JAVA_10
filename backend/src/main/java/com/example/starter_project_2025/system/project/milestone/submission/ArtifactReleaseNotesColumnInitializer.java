package com.example.starter_project_2025.system.project.milestone.submission;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Types;
import java.util.List;

/** Safely widens legacy VARCHAR release-notes columns while preserving existing rows. */
@Component
@Order(17)
@RequiredArgsConstructor
public class ArtifactReleaseNotesColumnInitializer implements CommandLineRunner {
    private static final List<String> TABLES = List.of("milestone_artifact_drafts", "milestone_artifact_submissions");
    private final DataSource dataSource;

    @Override
    public void run(String... args) throws Exception {
        try (var connection = dataSource.getConnection()) {
            var metadata = connection.getMetaData();
            String product = metadata.getDatabaseProductName();
            String tableCase = metadata.storesUpperCaseIdentifiers() ? "UPPER" : "LOWER";
            String columnName = metadata.storesUpperCaseIdentifiers() ? "RELEASE_NOTES" : "release_notes";
            for (String table : TABLES) {
                String tableName = "UPPER".equals(tableCase) ? table.toUpperCase() : table;
                try (var columns = metadata.getColumns(connection.getCatalog(), connection.getSchema(), tableName, columnName)) {
                    if (!columns.next()) continue;
                    int type = columns.getInt("DATA_TYPE");
                    if (type != Types.VARCHAR && type != Types.NVARCHAR && type != Types.LONGVARCHAR) continue;
                }
                String statement = switch (product) {
                    case "H2" -> "ALTER TABLE " + table + " ALTER COLUMN release_notes CLOB";
                    case "MySQL", "MariaDB" -> "ALTER TABLE " + table + " MODIFY COLUMN release_notes MEDIUMTEXT NULL";
                    case "PostgreSQL" -> "ALTER TABLE " + table + " ALTER COLUMN release_notes TYPE TEXT";
                    default -> null;
                };
                if (statement != null) {
                    try (var migration = connection.createStatement()) { migration.execute(statement); }
                }
            }
        }
    }
}
