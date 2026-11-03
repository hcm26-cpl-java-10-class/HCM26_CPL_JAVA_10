package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
@Order(21)
@RequiredArgsConstructor
public class ProjectHierarchySchemaInitializer implements CommandLineRunner {
    private final JdbcTemplate jdbc;

    @Override
    public void run(String... args) {
        Map<String, String> columns = Map.of(
                "project_assignments", "coordinator_team_id", "milestones", "team_id",
                "final_project_grades", "team_id", "milestone_waivers", "team_id",
                "project_completion_audits", "team_id", "milestone_submissions", "team_id");
        String product = jdbc.execute((org.springframework.jdbc.core.ConnectionCallback<String>)
                connection -> connection.getMetaData().getDatabaseProductName());
        columns.forEach((table, column) -> {
            var required = jdbc.queryForList("""
                    select is_nullable from information_schema.columns
                     where lower(table_name) = ? and lower(column_name) = ?
                    """, String.class, table, column);
            if (required.stream().noneMatch("NO"::equalsIgnoreCase)) return;
            String change = "MySQL".equals(product) || "MariaDB".equals(product)
                    ? " MODIFY COLUMN " + column + " BIGINT NULL"
                    : " ALTER COLUMN " + column + " DROP NOT NULL";
            jdbc.execute("ALTER TABLE " + table + change);
        });
    }
}
