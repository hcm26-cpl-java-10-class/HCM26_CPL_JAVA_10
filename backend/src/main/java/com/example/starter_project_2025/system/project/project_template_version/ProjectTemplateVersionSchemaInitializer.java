package com.example.starter_project_2025.system.project.project_template_version;

import java.sql.Connection;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Keeps the local schema of the project template version module usable after the
 * audit action codes grew.
 * <p>
 * {@code ProjectTemplateSnapshotAuditLog.action} was declared as
 * {@code VARCHAR(20)} while US-07 records {@code CREATE_INITIAL_VERSION}
 * (22 characters). Hibernate's {@code ddl-auto=update} does not widen existing
 * columns, so an already installed database kept the narrow column and every
 * template creation failed with a {@code DataIntegrityViolationException}.
 * This runner widens the column in place before the feature is used.
 */
@Slf4j
@Component
@Order(6)
@RequiredArgsConstructor
public class ProjectTemplateVersionSchemaInitializer implements CommandLineRunner {

    static final String AUDIT_TABLE = "project_template_version_audit_log";
    static final String ACTION_COLUMN = "action";
    static final int REQUIRED_ACTION_LENGTH = 50;

    private final DataSource dataSource;

    @Override
    public void run(String... args) throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            widenAuditAction(connection);
        }
    }

    private void widenAuditAction(Connection connection) throws Exception {
        var metadata = connection.getMetaData();
        boolean upper = metadata.storesUpperCaseIdentifiers();
        String table = upper ? AUDIT_TABLE.toUpperCase(java.util.Locale.ROOT) : AUDIT_TABLE;
        String column = upper ? ACTION_COLUMN.toUpperCase(java.util.Locale.ROOT) : ACTION_COLUMN;

        Integer size = null;
        try (var columns = metadata.getColumns(connection.getCatalog(), connection.getSchema(), table, column)) {
            if (columns.next()) {
                size = columns.getInt("COLUMN_SIZE");
            }
        }
        if (size == null || size >= REQUIRED_ACTION_LENGTH) {
            return;
        }

        String product = metadata.getDatabaseProductName();
        String statement = switch (product) {
            case "H2" -> "ALTER TABLE " + AUDIT_TABLE + " ALTER COLUMN " + ACTION_COLUMN
                    + " VARCHAR(" + REQUIRED_ACTION_LENGTH + ")";
            case "PostgreSQL" -> "ALTER TABLE " + AUDIT_TABLE + " ALTER COLUMN " + ACTION_COLUMN
                    + " TYPE VARCHAR(" + REQUIRED_ACTION_LENGTH + ")";
            case "MySQL", "MariaDB" -> "ALTER TABLE " + AUDIT_TABLE + " MODIFY COLUMN " + ACTION_COLUMN
                    + " VARCHAR(" + REQUIRED_ACTION_LENGTH + ") NOT NULL";
            default -> null;
        };
        if (statement == null) {
            log.warn("[PTV-SCHEMA] Cannot widen {}.{} on {}, check the column length manually",
                    AUDIT_TABLE, ACTION_COLUMN, product);
            return;
        }
        try (var migration = connection.createStatement()) {
            migration.execute(statement);
        }
        log.info("[PTV-SCHEMA] Widened {}.{} from {} to {}", AUDIT_TABLE, ACTION_COLUMN, size,
                REQUIRED_ACTION_LENGTH);
    }
}
