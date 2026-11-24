package com.example.starter_project_2025.system.git_integration.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Locale;

/**
 * One-off cleanup for databases that ran the first, project-bound design of
 * GI-01 ({@code git_integration_connections} with a NOT NULL {@code project_id}).
 * Copies each installation into {@code git_installations} (dropping the project
 * link), then drops the legacy tables. Idempotent and a no-op on new databases.
 */
@Slf4j
@Component
@Order(0)
@RequiredArgsConstructor
public class GitInstallationLegacyMigration implements CommandLineRunner {

    static final String LEGACY_CONNECTIONS = "git_integration_connections";
    static final String LEGACY_STATES = "git_integration_oauth_states";

    private static final String COPY_SQL = """
            INSERT INTO git_installations (tenant_id, provider, installation_id, account_id, account_login, account_type,
                repository_selection, status, connected_by_user_id, github_user_id, github_user_login,
                connected_at, last_verified_at, version, is_active, created_at, updated_at, created_by, updated_by)
            SELECT c.tenant_id, c.provider, c.installation_id, c.account_id, c.account_login, c.account_type,
                c.repository_selection, c.status, c.connected_by_user_id, c.github_user_id, c.github_user_login,
                c.connected_at, c.last_verified_at, 0, c.is_active, c.created_at, c.updated_at, c.created_by, c.updated_by
              FROM git_integration_connections c
             WHERE NOT EXISTS (SELECT 1 FROM git_installations g
                                WHERE g.provider = c.provider AND g.installation_id = c.installation_id)
            """;

    private final DataSource dataSource;
    private final JdbcTemplate jdbc;

    @Override
    public void run(String... args) throws SQLException {
        migrate();
    }

    /** Returns the number of installations copied from the legacy table. */
    public int migrate() throws SQLException {
        int copied = 0;
        if (tableExists(LEGACY_CONNECTIONS)) {
            // The legacy table already had UNIQUE(provider, installation_id): one row per installation.
            copied = jdbc.update(COPY_SQL);
            jdbc.execute("DROP TABLE " + LEGACY_CONNECTIONS);
            log.info("Git Integration: moved {} installation(s) from {} to git_installations", copied, LEGACY_CONNECTIONS);
        }
        if (tableExists(LEGACY_STATES)) {
            // OAuth states live for minutes; nothing worth keeping.
            jdbc.execute("DROP TABLE " + LEGACY_STATES);
            log.info("Git Integration: dropped legacy table {}", LEGACY_STATES);
        }
        return copied;
    }

    private boolean tableExists(String name) throws SQLException {
        try (Connection connection = dataSource.getConnection()) {
            var metadata = connection.getMetaData();
            String table = metadata.storesUpperCaseIdentifiers() ? name.toUpperCase(Locale.ROOT) : name;
            try (var rows = metadata.getTables(connection.getCatalog(), connection.getSchema(), table, new String[]{"TABLE"})) {
                return rows.next();
            }
        }
    }
}
