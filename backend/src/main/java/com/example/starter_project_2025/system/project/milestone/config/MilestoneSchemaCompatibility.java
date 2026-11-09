package com.example.starter_project_2025.system.project.milestone.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Locale;

/** Allows team-only workspaces to create reviewer submissions in an existing database. */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class MilestoneSchemaCompatibility implements ApplicationRunner {
    private final DataSource dataSource;
    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) throws SQLException {
        try (Connection connection = dataSource.getConnection()) {
            String product = connection.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT);
            boolean required = false;
            for (String table : new String[]{"milestone_submissions", "MILESTONE_SUBMISSIONS"}) {
                for (String column : new String[]{"project_id", "PROJECT_ID"}) {
                    try (ResultSet columns = connection.getMetaData().getColumns(null, null, table, column)) {
                        while (columns.next()) required |= columns.getInt("NULLABLE") == 0;
                    }
                }
            }
            if (!required) return;
            if (product.contains("mysql") || product.contains("mariadb"))
                jdbc.execute("ALTER TABLE milestone_submissions MODIFY COLUMN project_id BIGINT NULL");
            else if (product.contains("h2") || product.contains("postgresql"))
                jdbc.execute("ALTER TABLE milestone_submissions ALTER COLUMN project_id DROP NOT NULL");
            else throw new IllegalStateException("Unsupported database for milestone submission scope migration: " + product);
        }
    }
}
