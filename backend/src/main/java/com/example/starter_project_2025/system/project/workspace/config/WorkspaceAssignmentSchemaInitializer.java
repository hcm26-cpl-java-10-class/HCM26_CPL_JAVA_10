package com.example.starter_project_2025.system.project.workspace.config;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Order(20)
@RequiredArgsConstructor
public class WorkspaceAssignmentSchemaInitializer implements CommandLineRunner {
    private final JdbcTemplate jdbc;

    @Override
    public void run(String... args) {
        List<String> constraints = jdbc.queryForList("""
                select constraint_name from information_schema.table_constraints
                 where lower(table_name) = 'workspaces' and constraint_type = 'UNIQUE'
                   and lower(constraint_name) = 'uk_workspace_tenant_team'
                """, String.class);
        for (String name : constraints) {
            String product = jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<String>)
                    connection -> connection.getMetaData().getDatabaseProductName());
            String command = "MySQL".equals(product) || "MariaDB".equals(product)
                    ? "ALTER TABLE workspaces DROP INDEX " : "ALTER TABLE workspaces DROP CONSTRAINT ";
            if (!name.matches("[A-Za-z0-9_]+")) throw new IllegalStateException("Invalid workspace constraint identifier");
            jdbc.execute(command + name);
        }
    }
}
