package com.example.starter_project_2025.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.DatabaseMetaData;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

class LegacyH2RequiredColumnsInitializerTest {
    @Test
    void backfillsPopulatedLegacyTablesAndCanRunAgain() throws Exception {
        var dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:legacy-required-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE roles (id BIGINT PRIMARY KEY, name VARCHAR(100) NOT NULL)");
            statement.execute("INSERT INTO roles VALUES (1, 'ADMIN')");
            statement.execute("CREATE TABLE users (id BIGINT PRIMARY KEY, email VARCHAR(100) NOT NULL)");
            statement.execute("INSERT INTO users VALUES (1, 'existing@example.com')");
            statement.execute("CREATE TABLE student_scores (id BIGINT PRIMARY KEY, released_at TIMESTAMP)");
            statement.execute("INSERT INTO student_scores VALUES (1, NULL), (2, TIMESTAMP '2025-01-01 10:00:00')");
            statement.execute("CREATE TABLE lessons (id BIGINT PRIMARY KEY, course_id BIGINT NOT NULL, "
                    + "section_id BIGINT NOT NULL)");
            statement.execute("INSERT INTO lessons VALUES (1, 10, 20)");
        }

        var initializer = new LegacyH2RequiredColumnsInitializer(dataSource);
        initializer.run();
        initializer.run();

        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            var metadata = connection.getMetaData();
            for (String[] entry : new String[][]{{"ROLES", "IS_SYSTEM"}, {"USERS", "IS_GUEST"},
                    {"STUDENT_SCORES", "STATUS"}}) {
                try (var columns = metadata.getColumns(null, null, entry[0], entry[1])) {
                    assertThat(columns.next()).isTrue();
                    assertThat(columns.getInt("NULLABLE")).isEqualTo(DatabaseMetaData.columnNoNulls);
                }
            }
            try (var rows = statement.executeQuery("SELECT name, is_system FROM roles")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getString(1)).isEqualTo("ADMIN");
                assertThat(rows.getBoolean(2)).isFalse();
            }
            try (var rows = statement.executeQuery("SELECT email, is_guest FROM users")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getString(1)).isEqualTo("existing@example.com");
                assertThat(rows.getBoolean(2)).isFalse();
            }
            try (var rows = statement.executeQuery("SELECT status FROM student_scores ORDER BY id")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getString(1)).isEqualTo("DRAFT");
                assertThat(rows.next()).isTrue();
                assertThat(rows.getString(1)).isEqualTo("RELEASED");
            }
            statement.execute("INSERT INTO lessons (id, section_id) VALUES (2, 20)");
            try (var rows = statement.executeQuery("SELECT course_id FROM lessons ORDER BY id")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getLong(1)).isEqualTo(10);
                assertThat(rows.next()).isTrue();
                assertThat(rows.getObject(1)).isNull();
            }
        }
    }

    @Test
    void fillsOnlyNullValuesInPartiallyMigratedTables() throws Exception {
        var dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:legacy-required-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1", "sa", "");
        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            statement.execute("CREATE TABLE roles (id BIGINT PRIMARY KEY, is_system BOOLEAN)");
            statement.execute("INSERT INTO roles VALUES (1, TRUE), (2, NULL)");
            statement.execute("CREATE TABLE users (id BIGINT PRIMARY KEY, is_guest BOOLEAN)");
            statement.execute("INSERT INTO users VALUES (1, TRUE), (2, NULL)");
            statement.execute("CREATE TABLE student_scores (id BIGINT PRIMARY KEY, released_at TIMESTAMP, "
                    + "status VARCHAR(20))");
            statement.execute("INSERT INTO student_scores VALUES "
                    + "(1, NULL, 'REVIEWED'), (2, TIMESTAMP '2025-01-01 10:00:00', NULL)");
        }

        new LegacyH2RequiredColumnsInitializer(dataSource).run();

        try (var connection = dataSource.getConnection(); var statement = connection.createStatement()) {
            try (var rows = statement.executeQuery("SELECT is_system FROM roles ORDER BY id")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getBoolean(1)).isTrue();
                assertThat(rows.next()).isTrue();
                assertThat(rows.getBoolean(1)).isFalse();
                assertThat(rows.wasNull()).isFalse();
            }
            try (var rows = statement.executeQuery("SELECT is_guest FROM users ORDER BY id")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getBoolean(1)).isTrue();
                assertThat(rows.next()).isTrue();
                assertThat(rows.getBoolean(1)).isFalse();
                assertThat(rows.wasNull()).isFalse();
            }
            try (var rows = statement.executeQuery("SELECT status FROM student_scores ORDER BY id")) {
                assertThat(rows.next()).isTrue();
                assertThat(rows.getString(1)).isEqualTo("REVIEWED");
                assertThat(rows.next()).isTrue();
                assertThat(rows.getString(1)).isEqualTo("RELEASED");
            }
        }
    }
}
