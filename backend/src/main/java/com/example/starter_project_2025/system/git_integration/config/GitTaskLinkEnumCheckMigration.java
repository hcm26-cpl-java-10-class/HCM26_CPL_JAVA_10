package com.example.starter_project_2025.system.git_integration.config;

import com.example.starter_project_2025.system.git_integration.domain.BacklogLinkSource;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceField;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceReason;
import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.git_integration.domain.GitCommitSource;
import com.example.starter_project_2025.system.git_integration.domain.GitOAuthOutcome;
import com.example.starter_project_2025.system.git_integration.domain.GitOAuthPurpose;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncPhase;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * TM-03: Hibernate writes a {@code CHECK (status IN (...))} for each enum column when it
 * creates a table, and {@code ddl-auto=update} never widens it. A database created before
 * TM-03 therefore rejects EXCLUDED, UNLINKED_BY_USER and MERGED_PR. Such a constraint is
 * dropped when it misses a value of its enum (the values are checked in Java anyway).
 * A no-op on new databases, whose constraints list every value. GI-06 widened
 * {@code git_oauth_states.outcome} the same way.
 * <p>
 * Hibernate 6 declares the same columns with a native {@code ENUM(...)} type on H2 and MySQL,
 * which rejects a new value just like the check does ("Value not permitted for column").
 * Such a column is turned into a {@code VARCHAR} when it misses a value.
 */
@Slf4j
@Component
@Order(1)
@RequiredArgsConstructor
public class GitTaskLinkEnumCheckMigration implements CommandLineRunner {

    private static final Pattern IDENTIFIER = Pattern.compile("[A-Za-z0-9_]+");

    /** table → enum column → values it must accept. */
    static final Map<String, Map<String, List<String>>> ENUM_COLUMNS = Map.of(
            "backlog_reference", columns(
                    "status", BacklogReferenceStatus.values(),
                    "reason", BacklogReferenceReason.values(),
                    "source_field", BacklogReferenceField.values(),
                    "source_type", GitArtifactType.values()),
            "backlog_git_link", columns(
                    "link_source", BacklogLinkSource.values(),
                    "artifact_type", GitArtifactType.values()),
            // GI-06: new outcomes of the Connect GitHub account flow.
            "git_oauth_states", columns(
                    "outcome", GitOAuthOutcome.values(),
                    "purpose", GitOAuthPurpose.values()),
            // SY-01: PARTIAL.
            "git_sync_jobs", columns(
                    "status", GitSyncJobStatus.values(),
                    "type", GitSyncJobType.values(),
                    "phase", GitSyncPhase.values()),
            // SY-01: GRAPHQL_HISTORY. A VARCHAR enum still gets a CHECK (source IN (...)) from Hibernate.
            "git_commits", columns(
                    "source", GitCommitSource.values()));

    private final DataSource dataSource;

    @Override
    public void run(String... args) throws SQLException {
        List<String> dropped = migrate();
        if (!dropped.isEmpty()) log.info("Git Integration: widened outdated enum columns {}", dropped);
    }

    /** Drops the outdated constraints and widens outdated enum columns; returns them as {@code table.constraint|column}. */
    public List<String> migrate() throws SQLException {
        List<String> dropped = new ArrayList<>();
        try (Connection connection = dataSource.getConnection()) {
            String product = connection.getMetaData().getDatabaseProductName().toLowerCase(Locale.ROOT);
            boolean mysql = product.contains("mysql") || product.contains("mariadb");
            String schema = connection.getSchema() != null ? connection.getSchema() : connection.getCatalog();
            for (var table : ENUM_COLUMNS.entrySet()) {
                for (var check : checks(connection, schema, table.getKey()).entrySet()) {
                    if (!outdated(check.getValue(), table.getValue()) || !IDENTIFIER.matcher(check.getKey()).matches()) continue;
                    try (var statement = connection.createStatement()) {
                        statement.execute("ALTER TABLE " + table.getKey() + (mysql ? " DROP CHECK " : " DROP CONSTRAINT ") + check.getKey());
                    }
                    dropped.add(table.getKey() + "." + check.getKey());
                }
                for (var column : enumColumns(connection, mysql, schema, table.getKey()).entrySet()) {
                    List<String> values = table.getValue().get(column.getKey().toLowerCase(Locale.ROOT));
                    if (values == null || !IDENTIFIER.matcher(column.getKey()).matches()) continue;
                    String declared = column.getValue().values().toLowerCase(Locale.ROOT);
                    if (values.stream().allMatch(value -> declared.contains("'" + value.toLowerCase(Locale.ROOT) + "'"))) continue;
                    try (var statement = connection.createStatement()) {
                        statement.execute(mysql
                                ? "ALTER TABLE " + table.getKey() + " MODIFY COLUMN " + column.getKey() + " VARCHAR(64)"
                                        + (column.getValue().nullable() ? " NULL" : " NOT NULL")
                                : "ALTER TABLE " + table.getKey() + " ALTER COLUMN " + column.getKey() + " SET DATA TYPE VARCHAR(64)");
                    }
                    dropped.add(table.getKey() + "." + column.getKey());
                }
            }
        }
        return dropped;
    }

    /** True when the clause is about one of the enum columns and misses one of its values. */
    static boolean outdated(String clause, Map<String, List<String>> columns) {
        String text = clause.toLowerCase(Locale.ROOT);
        for (var column : columns.entrySet()) {
            if (!Pattern.compile("(?<![a-z_])" + column.getKey() + "(?![a-z_])").matcher(text).find()) continue;
            boolean missing = column.getValue().stream()
                    .anyMatch(value -> !text.contains("'" + value.toLowerCase(Locale.ROOT) + "'"));
            if (missing) return true;
        }
        return false;
    }

    private static Map<String, String> checks(Connection connection, String schema, String table) throws SQLException {
        String sql = """
                SELECT tc.constraint_name, cc.check_clause
                  FROM information_schema.table_constraints tc
                  JOIN information_schema.check_constraints cc
                    ON cc.constraint_schema = tc.constraint_schema AND cc.constraint_name = tc.constraint_name
                 WHERE tc.constraint_type = 'CHECK' AND tc.table_schema = ? AND LOWER(tc.table_name) = ?""";
        Map<String, String> found = new LinkedHashMap<>();
        try (var query = connection.prepareStatement(sql)) {
            query.setString(1, schema);
            query.setString(2, table);
            try (var rows = query.executeQuery()) {
                while (rows.next()) found.put(rows.getString(1), rows.getString(2));
            }
        }
        return found;
    }

    private record EnumColumn(String values, boolean nullable) {
    }

    /** Native enum columns of a table → their declared values (as {@code 'A','B'} text). */
    private static Map<String, EnumColumn> enumColumns(Connection connection, boolean mysql, String schema, String table) throws SQLException {
        String sql = mysql ? """
                SELECT column_name, is_nullable, column_type
                  FROM information_schema.columns
                 WHERE table_schema = ? AND LOWER(table_name) = ? AND LOWER(data_type) = 'enum'"""
                : """
                SELECT c.column_name, c.is_nullable, '''' || e.value_name || ''''
                  FROM information_schema.columns c
                  LEFT JOIN information_schema.enum_values e
                    ON e.object_schema = c.table_schema AND e.object_name = c.table_name
                   AND e.object_type = 'TABLE' AND e.enum_identifier = c.dtd_identifier
                 WHERE c.table_schema = ? AND LOWER(c.table_name) = ? AND c.data_type = 'ENUM'""";
        Map<String, EnumColumn> found = new LinkedHashMap<>();
        try (var query = connection.prepareStatement(sql)) {
            query.setString(1, schema);
            query.setString(2, table);
            try (var rows = query.executeQuery()) {
                while (rows.next()) {
                    String value = rows.getString(3) == null ? "" : rows.getString(3);
                    boolean nullable = "YES".equalsIgnoreCase(rows.getString(2));
                    found.merge(rows.getString(1), new EnumColumn(value, nullable),
                            (a, b) -> new EnumColumn(a.values() + "," + b.values(), a.nullable()));
                }
            }
        } catch (SQLException unsupported) {
            // A database without native enums (or this catalog view): nothing to widen.
            return Map.of();
        }
        return found;
    }

    private static Map<String, List<String>> columns(Object... pairs) {
        Map<String, List<String>> columns = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            columns.put((String) pairs[i], Arrays.stream((Enum<?>[]) pairs[i + 1]).map(Enum::name).toList());
        }
        return columns;
    }
}
