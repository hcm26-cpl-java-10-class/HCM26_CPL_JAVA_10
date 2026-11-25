package com.example.starter_project_2025.system.git_integration.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;
import java.util.Locale;

/**
 * SY-04: one-off upgrade of {@code git_webhook_events.status} written by SY-03.
 * <ol>
 *   <li>Hibernate created the column as a native {@code ENUM} (H2 and MySQL), whose
 *       value list {@code ddl-auto=update} never changes, so the new
 *       FAILED_RETRYABLE state could not be stored. The column becomes VARCHAR(20).</li>
 *   <li>Old values are renamed: FAILED (was "will retry") → FAILED_RETRYABLE, then
 *       DEAD (was "gave up") → FAILED.</li>
 * </ol>
 * The renaming runs only when the column was just converted or DEAD rows remain,
 * so running it again never turns a new FAILED event back into a retryable one.
 * A no-op on new databases.
 */
@Slf4j
@Component
@Order(0)
@RequiredArgsConstructor
public class GitWebhookStatusMigration implements CommandLineRunner {

    static final String TABLE = "git_webhook_events";

    private final DataSource dataSource;
    private final JdbcTemplate jdbc;

    @Override
    public void run(String... args) throws SQLException {
        migrate();
    }

    /** Returns true when anything was changed. */
    public boolean migrate() throws SQLException {
        String product;
        String columnType;
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData metadata = connection.getMetaData();
            product = metadata.getDatabaseProductName().toLowerCase(Locale.ROOT);
            columnType = columnType(connection, metadata);
        }
        if (columnType == null) {
            return false; // table not created yet: Hibernate creates it with VARCHAR
        }
        boolean converted = false;
        if (columnType.contains("ENUM")) {
            jdbc.execute(product.contains("mysql") || product.contains("mariadb")
                    ? "ALTER TABLE " + TABLE + " MODIFY status VARCHAR(20) NOT NULL"
                    : "ALTER TABLE " + TABLE + " ALTER COLUMN status SET DATA TYPE VARCHAR(20)");
            converted = true;
        }
        Integer dead = jdbc.queryForObject("SELECT COUNT(*) FROM " + TABLE + " WHERE status = 'DEAD'", Integer.class);
        if (!converted && (dead == null || dead == 0)) {
            return false;
        }
        int retryable = jdbc.update("UPDATE " + TABLE + " SET status = 'FAILED_RETRYABLE' WHERE status = 'FAILED'");
        int failed = jdbc.update("UPDATE " + TABLE + " SET status = 'FAILED' WHERE status = 'DEAD'");
        log.info("Git Integration: {}.status upgraded (converted to VARCHAR: {}, FAILED→FAILED_RETRYABLE: {}, DEAD→FAILED: {})",
                TABLE, converted, retryable, failed);
        return true;
    }

    private static String columnType(Connection connection, DatabaseMetaData metadata) throws SQLException {
        boolean upper = metadata.storesUpperCaseIdentifiers();
        String table = upper ? TABLE.toUpperCase(Locale.ROOT) : TABLE;
        String column = upper ? "STATUS" : "status";
        try (var rows = metadata.getColumns(connection.getCatalog(), connection.getSchema(), table, column)) {
            return rows.next() ? rows.getString("TYPE_NAME").toUpperCase(Locale.ROOT) : null;
        }
    }
}
