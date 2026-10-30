package com.example.starter_project_2025.system.project.template;

import java.sql.Connection;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(5)
@RequiredArgsConstructor
public class ProjectTemplateSchemaInitializer implements CommandLineRunner {
    private final DataSource dataSource;

    @Override
    public void run(String... args) throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            ensureTenantConstraint(connection);
            removeGlobalCodeConstraint(connection);
            try (var statement = connection.createStatement()) {
                statement.executeUpdate("UPDATE project_templates SET version_family_id = id WHERE version_family_id IS NULL");
            }
        }
    }

    private void ensureTenantConstraint(Connection connection) throws Exception {
        var metadata = connection.getMetaData();
        String table = metadata.storesUpperCaseIdentifiers() ? "PROJECT_TEMPLATES" : "project_templates";
        var indexes = new HashMap<String, List<String>>();
        try (var rows = metadata.getIndexInfo(connection.getCatalog(), connection.getSchema(), table, true, false)) {
            while (rows.next()) {
                String name = rows.getString("INDEX_NAME");
                String column = rows.getString("COLUMN_NAME");
                if (name != null && column != null) {
                    indexes.computeIfAbsent(name, ignored -> new ArrayList<>()).add(column.toLowerCase(Locale.ROOT));
                }
            }
        }
        Set<String> expected = Set.of("tenant_id", "code", "template_version");
        if (indexes.values().stream().anyMatch(columns -> columns.size() == 3 && Set.copyOf(columns).equals(expected))) {
            return;
        }
        try (var statement = connection.createStatement()) {
            statement.execute("ALTER TABLE project_templates ADD CONSTRAINT uk_template_tenant_code_version "
                    + "UNIQUE (tenant_id, code, template_version)");
        }
    }

    private void removeGlobalCodeConstraint(Connection connection) throws Exception {
        String schema = connection.getSchema();
        if (schema == null) schema = connection.getCatalog();
        String sql = "SELECT constraint_name FROM information_schema.key_column_usage "
                + "WHERE table_schema = ? AND LOWER(table_name) = 'project_templates' "
                + "GROUP BY constraint_name HAVING COUNT(*) = 1 AND LOWER(MIN(column_name)) = 'code'";
        var names = new ArrayList<String>();
        try (var query = connection.prepareStatement(sql)) {
            query.setString(1, schema);
            try (var rows = query.executeQuery()) {
                while (rows.next()) names.add(rows.getString(1));
            }
        }
        String product = connection.getMetaData().getDatabaseProductName();
        boolean mysql = "MySQL".equals(product) || "MariaDB".equals(product);
        String quote = connection.getMetaData().getIdentifierQuoteString().strip();
        for (String name : names) {
            String identifier = quote + name.replace(quote, quote + quote) + quote;
            try (var statement = connection.createStatement()) {
                statement.execute("ALTER TABLE project_templates " + (mysql ? "DROP INDEX " : "DROP CONSTRAINT ") + identifier);
            }
        }
    }
}
