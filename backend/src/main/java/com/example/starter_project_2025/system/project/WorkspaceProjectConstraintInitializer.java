package com.example.starter_project_2025.system.project;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;

/** Recheck after demo replacement: an old shared-project fixture may have blocked Hibernate's DDL. */
@Component @Order(21) @RequiredArgsConstructor
public class WorkspaceProjectConstraintInitializer implements CommandLineRunner {
    private final DataSource dataSource;

    @Override public void run(String... args) throws Exception {
        try (var connection = dataSource.getConnection()) {
            var metadata = connection.getMetaData();
            var indexes = new HashMap<String, List<String>>();
            try (var rows = metadata.getIndexInfo(connection.getCatalog(), connection.getSchema(),
                    metadata.storesUpperCaseIdentifiers() ? "TEAMS" : "teams", true, false)) {
                while (rows.next()) {
                    String name = rows.getString("INDEX_NAME"), column = rows.getString("COLUMN_NAME");
                    if (name != null && column != null) indexes.computeIfAbsent(name, ignored -> new ArrayList<>()).add(column);
                }
            }
            if (indexes.values().stream().anyMatch(columns -> columns.size() == 1 && "project_id".equalsIgnoreCase(columns.getFirst()))) return;
            try (var migration = connection.createStatement()) {
                migration.execute("ALTER TABLE teams ADD CONSTRAINT uk_team_project UNIQUE (project_id)");
            }
        }
    }
}
