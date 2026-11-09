package com.example.starter_project_2025.system.project.sprint;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Keeps the sprint schema aligned with the workspace-scoped uniqueness rule.
 * <p>
 * Sprint names used to be unique across the whole tenant ({@code uk_sprint_name}
 * on {@code name} only), so a second project could never reuse a name such as
 * "Sprint 1". The rule is now scoped to the project (or to the team for
 * team-only workspaces). Hibernate's {@code ddl-auto=update} adds the new
 * composite constraints but never drops the old one, so an already installed
 * database keeps rejecting the name of another project. This runner removes the
 * legacy single-column constraint before the sprint module is used.
 */
@Slf4j
@Component
@Order(3)
@RequiredArgsConstructor
public class SprintNameConstraintInitializer implements CommandLineRunner {

    static final String TABLE = "sprint";
    static final String NAME_COLUMN = "name";

    private final DataSource dataSource;

    @Override
    public void run(String... args) throws Exception {

        try (Connection connection = dataSource.getConnection()) {

            removeGlobalNameConstraint(connection);
            ensureScopedConstraint(connection, "uk_sprint_project_name", "project_id");
            ensureScopedConstraint(connection, "uk_sprint_team_name", "team_id");
        }
    }

    /**
     * Drops every unique constraint/index of {@code sprint} that covers the
     * {@code name} column alone (the legacy tenant-wide rule).
     */
    private void removeGlobalNameConstraint(Connection connection) throws Exception {

        String schema = connection.getSchema();
        if (schema == null) {
            schema = connection.getCatalog();
        }

        String sql = "SELECT constraint_name FROM information_schema.key_column_usage "
                + "WHERE table_schema = ? AND LOWER(table_name) = ? "
                + "GROUP BY constraint_name HAVING COUNT(*) = 1 AND LOWER(MIN(column_name)) = ?";

        List<String> names = new ArrayList<>();
        try (var query = connection.prepareStatement(sql)) {
            query.setString(1, schema);
            query.setString(2, TABLE);
            query.setString(3, NAME_COLUMN);
            try (var rows = query.executeQuery()) {
                while (rows.next()) {
                    names.add(rows.getString(1));
                }
            }
        }

        String product = connection.getMetaData().getDatabaseProductName();
        boolean mysql = "MySQL".equals(product) || "MariaDB".equals(product);
        String quote = connection.getMetaData().getIdentifierQuoteString().strip();

        for (String name : names) {
            String identifier = quote + name.replace(quote, quote + quote) + quote;
            try (var statement = connection.createStatement()) {
                statement.execute("ALTER TABLE " + TABLE + (mysql ? " DROP INDEX " : " DROP CONSTRAINT ")
                        + identifier);
                log.info("[SPRINT-SCHEMA] Dropped tenant-wide sprint name constraint {}", name);
            } catch (Exception exception) {
                log.warn("[SPRINT-SCHEMA] Could not drop sprint constraint {} on {}: {}",
                        name, product, exception.getMessage());
            }
        }
    }

    /**
     * Makes sure the workspace-scoped unique constraint exists. On a database
     * created by Hibernate the constraint is already there and the check
     * returns immediately.
     */
    private void ensureScopedConstraint(Connection connection, String constraintName, String scopeColumn)
            throws Exception {

        var metadata = connection.getMetaData();
        String table = metadata.storesUpperCaseIdentifiers()
                ? TABLE.toUpperCase(Locale.ROOT)
                : TABLE;

        var indexes = new HashMap<String, List<String>>();
        try (var rows = metadata.getIndexInfo(connection.getCatalog(), connection.getSchema(), table, true, false)) {
            while (rows.next()) {
                String index = rows.getString("INDEX_NAME");
                String column = rows.getString("COLUMN_NAME");
                if (index != null && column != null) {
                    indexes.computeIfAbsent(index, ignored -> new ArrayList<>())
                            .add(column.toLowerCase(Locale.ROOT));
                }
            }
        }

        Set<String> expected = Set.of(scopeColumn, NAME_COLUMN);
        if (indexes.values().stream()
                .anyMatch(columns -> columns.size() == 2 && Set.copyOf(columns).equals(expected))) {
            return;
        }

        try (var statement = connection.createStatement()) {
            statement.execute("ALTER TABLE " + TABLE + " ADD CONSTRAINT " + constraintName
                    + " UNIQUE (" + scopeColumn + ", " + NAME_COLUMN + ")");
            log.info("[SPRINT-SCHEMA] Added sprint constraint {} ({}, {})",
                    constraintName, scopeColumn, NAME_COLUMN);
        } catch (Exception exception) {
            log.warn("[SPRINT-SCHEMA] Could not add sprint constraint {}: {}",
                    constraintName, exception.getMessage());
        }
    }
}
