package com.example.starter_project_2025.config;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** Backfills required columns that Hibernate cannot add to populated H2 tables. */
@Component
@Order(-120)
@RequiredArgsConstructor
public class LegacyH2RequiredColumnsInitializer implements CommandLineRunner {
    private final DataSource dataSource;

    @Override
    public void run(String... args) throws Exception {
        try (var connection = dataSource.getConnection()) {
            var metadata = connection.getMetaData();
            if (!"H2".equals(metadata.getDatabaseProductName())) return;

            ensureBooleanColumn(connection, "roles", "is_system");
            ensureBooleanColumn(connection, "users", "is_guest");
            ensureScoreStatus(connection);
            relaxLegacyLessonCourseId(connection);
        }
    }

    private void ensureBooleanColumn(Connection connection, String table, String column) throws Exception {
        if (!hasTable(connection, table)) return;
        Boolean nullable = columnNullable(connection, table, column);
        try (var statement = connection.createStatement()) {
            if (nullable == null) {
                statement.execute("ALTER TABLE " + table + " ADD COLUMN " + column
                        + " BOOLEAN DEFAULT FALSE NOT NULL");
            } else if (nullable) {
                statement.executeUpdate("UPDATE " + table + " SET " + column + " = FALSE WHERE " + column + " IS NULL");
                statement.execute("ALTER TABLE " + table + " ALTER COLUMN " + column + " SET NOT NULL");
            }
        }
    }

    private void ensureScoreStatus(Connection connection) throws Exception {
        String table = "student_scores";
        if (!hasTable(connection, table)) return;
        Boolean nullable = columnNullable(connection, table, "status");
        if (nullable != null && !nullable) return;

        boolean releasedAtExists = columnNullable(connection, table, "released_at") != null;
        try (var statement = connection.createStatement()) {
            if (nullable == null) {
                statement.execute("ALTER TABLE student_scores ADD COLUMN status "
                        + "ENUM('DRAFT','REVIEWED','RELEASED','ADJUSTED') DEFAULT 'DRAFT' NOT NULL");
                if (releasedAtExists) {
                    statement.executeUpdate("UPDATE student_scores SET status = 'RELEASED' WHERE released_at IS NOT NULL");
                }
            } else {
                statement.executeUpdate("UPDATE student_scores SET status = "
                        + (releasedAtExists ? "CASE WHEN released_at IS NOT NULL THEN 'RELEASED' ELSE 'DRAFT' END"
                        : "'DRAFT'") + " WHERE status IS NULL");
                statement.execute("ALTER TABLE student_scores ALTER COLUMN status SET NOT NULL");
            }
        }
    }

    private void relaxLegacyLessonCourseId(Connection connection) throws Exception {
        if (!hasTable(connection, "lessons") || columnNullable(connection, "lessons", "section_id") == null
                || !Boolean.FALSE.equals(columnNullable(connection, "lessons", "course_id"))) return;
        try (var statement = connection.createStatement()) {
            statement.execute("ALTER TABLE lessons ALTER COLUMN course_id DROP NOT NULL");
        }
    }

    private boolean hasTable(Connection connection, String table) throws Exception {
        try (var tables = connection.getMetaData().getTables(connection.getCatalog(), connection.getSchema(),
                metadataName(connection.getMetaData(), table), null)) {
            return tables.next();
        }
    }

    private Boolean columnNullable(Connection connection, String table, String column) throws Exception {
        DatabaseMetaData metadata = connection.getMetaData();
        try (var columns = metadata.getColumns(connection.getCatalog(), connection.getSchema(),
                metadataName(metadata, table), metadataName(metadata, column))) {
            if (!columns.next()) return null;
            return columns.getInt("NULLABLE") != DatabaseMetaData.columnNoNulls;
        }
    }

    private String metadataName(DatabaseMetaData metadata, String name) throws Exception {
        return metadata.storesUpperCaseIdentifiers() ? name.toUpperCase(java.util.Locale.ROOT) : name;
    }
}
