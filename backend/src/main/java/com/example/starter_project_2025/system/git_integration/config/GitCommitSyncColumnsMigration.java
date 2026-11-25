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
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * SY-01: one-off upgrade of {@code git_commits} for commits imported by a sync job.
 * <ol>
 *   <li>{@code ingested_event_id} was NOT NULL (every commit came from a webhook); a synced
 *       commit has no webhook event, and {@code ddl-auto=update} never relaxes a constraint.</li>
 *   <li>Backfills the new flags of rows stored before: {@code is_merge} from {@code parent_count}
 *       and {@code is_bot} from the GitHub logins.</li>
 * </ol>
 * Every step only touches rows still to upgrade, so running it again changes nothing.
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class GitCommitSyncColumnsMigration implements CommandLineRunner {

    static final String TABLE = "git_commits";

    private final DataSource dataSource;
    private final JdbcTemplate jdbc;

    @Override
    public void run(String... args) throws SQLException {
        List<String> changes = migrate();
        if (!changes.isEmpty()) log.info("Git Integration: {} upgraded for commit sync {}", TABLE, changes);
    }

    /** Returns what was changed (empty when nothing was). */
    public List<String> migrate() throws SQLException {
        List<String> changes = new ArrayList<>();
        boolean mysql;
        Boolean eventIdNullable;
        boolean flags;
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData metadata = connection.getMetaData();
            String product = metadata.getDatabaseProductName().toLowerCase(Locale.ROOT);
            mysql = product.contains("mysql") || product.contains("mariadb");
            eventIdNullable = nullable(connection, metadata, "ingested_event_id");
            flags = nullable(connection, metadata, "is_merge") != null && nullable(connection, metadata, "is_bot") != null;
        }
        if (eventIdNullable == null) return changes; // table not created yet: Hibernate creates it as needed
        if (!eventIdNullable) {
            jdbc.execute(mysql
                    ? "ALTER TABLE " + TABLE + " MODIFY COLUMN ingested_event_id BIGINT NULL"
                    : "ALTER TABLE " + TABLE + " ALTER COLUMN ingested_event_id SET NULL");
            changes.add("ingested_event_id nullable");
        }
        if (!flags) return changes;
        int merges = jdbc.update("UPDATE " + TABLE + " SET is_merge = (parent_count >= 2)"
                + " WHERE is_merge IS NULL AND parent_count IS NOT NULL");
        int bots = jdbc.update("UPDATE " + TABLE + " SET is_bot = CASE WHEN LOWER(author_login) LIKE '%[bot]'"
                + " OR (author_login IS NULL AND LOWER(committer_login) LIKE '%[bot]') THEN TRUE ELSE FALSE END"
                + " WHERE is_bot IS NULL");
        if (merges > 0) changes.add("is_merge backfilled: " + merges);
        if (bots > 0) changes.add("is_bot backfilled: " + bots);
        return changes;
    }

    /** True/false when the column exists, null when it does not. */
    private static Boolean nullable(Connection connection, DatabaseMetaData metadata, String column) throws SQLException {
        boolean upper = metadata.storesUpperCaseIdentifiers();
        String table = upper ? TABLE.toUpperCase(Locale.ROOT) : TABLE;
        String name = upper ? column.toUpperCase(Locale.ROOT) : column;
        try (var rows = metadata.getColumns(connection.getCatalog(), connection.getSchema(), table, name)) {
            return rows.next() ? rows.getInt("NULLABLE") != DatabaseMetaData.columnNoNulls : null;
        }
    }
}
