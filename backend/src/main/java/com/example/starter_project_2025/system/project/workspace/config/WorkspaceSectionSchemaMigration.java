package com.example.starter_project_2025.system.project.workspace.config;

import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceSection;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.stream.Collectors;

/** Hibernate schema update does not extend an existing H2 native enum. */
@Slf4j
@Component
@Order(4)
@RequiredArgsConstructor
public class WorkspaceSectionSchemaMigration implements CommandLineRunner {
    private final DataSource dataSource;

    @Override
    public void run(String... args) throws SQLException {
        try (var connection = dataSource.getConnection()) {
            var metadata = connection.getMetaData();
            if (!"H2".equalsIgnoreCase(metadata.getDatabaseProductName())) return;
            String schema = connection.getSchema();
            boolean upper = metadata.storesUpperCaseIdentifiers();
            String table = upper ? "WORKSPACE_SECTIONS" : "workspace_sections";
            String column = upper ? "SECTION" : "section";
            try (var columns = metadata.getColumns(connection.getCatalog(), schema, table, column)) {
                if (!columns.next()) return;
                String type = columns.getString("TYPE_NAME");
                if (type == null || !type.toUpperCase(Locale.ROOT).startsWith("ENUM")) return;
            }

            var values = new LinkedHashSet<String>();
            try (var query = connection.prepareStatement("""
                    SELECT e.VALUE_NAME FROM INFORMATION_SCHEMA.ENUM_VALUES e
                    JOIN INFORMATION_SCHEMA.COLUMNS c
                      ON e.OBJECT_CATALOG=c.TABLE_CATALOG AND e.OBJECT_SCHEMA=c.TABLE_SCHEMA
                      AND e.OBJECT_NAME=c.TABLE_NAME AND e.ENUM_IDENTIFIER=c.DTD_IDENTIFIER
                    WHERE c.TABLE_SCHEMA=? AND c.TABLE_NAME=? AND c.COLUMN_NAME=?
                      AND e.OBJECT_TYPE='TABLE' ORDER BY CAST(e.VALUE_ORDINAL AS INTEGER)
                    """)) {
                query.setString(1, schema);
                query.setString(2, table);
                query.setString(3, column);
                try (var rows = query.executeQuery()) {
                    while (rows.next()) values.add(rows.getString(1));
                }
            }
            if (values.isEmpty()) throw new SQLException("Cannot read the existing workspace section enum values");
            boolean changed = values.addAll(Arrays.stream(WorkspaceSection.values()).map(Enum::name).toList());
            if (!changed) return;

            // Retain existing labels and their order, including labels from newer versions.
            String labels = values.stream().map(value -> "'" + value.replace("'", "''") + "'")
                    .collect(Collectors.joining(","));
            try (var statement = connection.createStatement()) {
                statement.execute("ALTER TABLE " + quote(schema) + "." + quote(table)
                        + " ALTER COLUMN " + quote(column) + " ENUM(" + labels + ")");
            }
            log.info("Extended legacy H2 workspace_sections.section enum to support all current workspace sections");
        }
    }

    private static String quote(String identifier) {
        return "\"" + identifier.replace("\"", "\"\"") + "\"";
    }
}
