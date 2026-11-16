package com.example.starter_project_2025.system.project.template;

import java.sql.Connection;
import java.sql.SQLException;
import java.sql.SQLIntegrityConstraintViolationException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.jdbc.datasource.init.ScriptException;
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
            migrateLevelColumn(connection);
            initializeCatalog(connection);
        }
    }

    private void migrateLevelColumn(Connection connection) throws SQLException {
        var metadata = connection.getMetaData();
        boolean upperCase = metadata.storesUpperCaseIdentifiers();
        try (var columns = metadata.getColumns(connection.getCatalog(), connection.getSchema(),
                upperCase ? "PROJECT_TEMPLATES" : "project_templates", upperCase ? "DIFFICULTY_LEVEL" : "difficulty_level")) {
            if (!columns.next() || !columns.getString("TYPE_NAME").toUpperCase(Locale.ROOT).startsWith("ENUM")) return;
        }
        String product = metadata.getDatabaseProductName();
        boolean mysql = "MySQL".equals(product) || "MariaDB".equals(product);
        try (var statement = connection.createStatement()) {
            statement.execute("ALTER TABLE project_templates " + (mysql
                    ? "MODIFY COLUMN difficulty_level VARCHAR(20) NULL"
                    : "ALTER COLUMN difficulty_level SET DATA TYPE VARCHAR(20)"));
        }
    }

    private void initializeCatalog(Connection connection) throws SQLException {
        try (var statement = connection.createStatement()) {
            statement.execute("""
                    CREATE TABLE IF NOT EXISTS project_template_catalog (
                        option_kind VARCHAR(10) NOT NULL,
                        tenant_scope_id BIGINT NOT NULL DEFAULT 0,
                        option_value VARCHAR(255) NOT NULL,
                        label VARCHAR(255) NOT NULL,
                        sort_order INTEGER NOT NULL DEFAULT 0,
                        PRIMARY KEY (option_kind, tenant_scope_id, option_value)
                    )
                    """);
        }
        if (hasCatalogEntries(connection)) return;
        try {
            new ResourceDatabasePopulator(new ClassPathResource("db/project-template-catalog-seed.sql")).populate(connection);
        } catch (ScriptException exception) {
            if (!(exception.getCause() instanceof SQLIntegrityConstraintViolationException) || !hasCatalogEntries(connection)) {
                throw exception;
            }
        }
    }

    private boolean hasCatalogEntries(Connection connection) throws SQLException {
        try (var statement = connection.createStatement()) {
            statement.setMaxRows(1);
            try (var rows = statement.executeQuery("SELECT option_value FROM project_template_catalog")) {
                return rows.next();
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
        Set<String> expected = Set.of("tenant_id", "code_scope_id", "code", "template_version");
        if (indexes.values().stream().anyMatch(columns -> columns.size() == 4 && Set.copyOf(columns).equals(expected))) {
            return;
        }
        try (var statement = connection.createStatement()) {
            statement.execute("ALTER TABLE project_templates ADD CONSTRAINT uk_template_code_scope_version "
                    + "UNIQUE (tenant_id, code_scope_id, code, template_version)");
        }
    }

    private void removeGlobalCodeConstraint(Connection connection) throws Exception {
        String schema = connection.getSchema();
        if (schema == null) schema = connection.getCatalog();
        String sql = "SELECT constraint_name FROM information_schema.key_column_usage "
                + "WHERE table_schema = ? AND LOWER(table_name) = 'project_templates' "
                + "GROUP BY constraint_name HAVING (COUNT(*) = 1 AND LOWER(MIN(column_name)) = 'code') "
                + "OR (COUNT(*) = 3 AND SUM(CASE WHEN LOWER(column_name) IN "
                + "('tenant_id', 'code', 'template_version') THEN 1 ELSE 0 END) = 3)";
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
