package com.example.starter_project_2025.system.project.workspace.demo;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;

@Slf4j @Component @Order(20) @Profile("!test")
@ConditionalOnProperty(name = "app.workspace.demo.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class WorkspaceDemoDataInitializer implements CommandLineRunner {
    private final WorkspaceDemoDataService demo;
    private final DataSource dataSource;
    private final com.example.starter_project_2025.system.project.workspace.config.LegacyH2ProjectSchemaMigration legacyMigration;
    @Override public void run(String... args) throws Exception {
        if (legacyMigration.isMigratedDatabase()) {
            log.info("Workspace demo reset skipped: this database contains preserved legacy workspaces.");
            return;
        }
        try (var connection = dataSource.getConnection()) {
            // Default fixtures are only for the local H2 application.
            if (!connection.getMetaData().getURL().startsWith("jdbc:h2:")) return;
        }
        try { demo.seed(); }
        catch (IllegalStateException exception) {
            log.warn("Workspace demo setup was skipped: {}", exception.getMessage());
            return;
        }
        log.info("Workspace demo fixtures are ready for workspace creation, overview and member access checks.");
    }
}
