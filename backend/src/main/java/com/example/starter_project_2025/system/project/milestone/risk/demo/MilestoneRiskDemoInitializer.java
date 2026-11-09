package com.example.starter_project_2025.system.project.milestone.risk.demo;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;
@Component @Order(22) @Profile("!test & !prod") @RequiredArgsConstructor
@ConditionalOnProperty(name = "app.task-alert.demo.enabled", havingValue = "true", matchIfMissing = true)
public class MilestoneRiskDemoInitializer implements CommandLineRunner {
    private final MilestoneRiskDemoDataService demo;
    private final DataSource dataSource;
    private final com.example.starter_project_2025.system.project.workspace.config.LegacyH2ProjectSchemaMigration legacyMigration;
    @Override public void run(String... args) throws Exception {
        if (legacyMigration.isMigratedDatabase()) return;
        try (var connection = dataSource.getConnection()) {
            if (!connection.getMetaData().getURL().startsWith("jdbc:h2:")) return;
        }
        demo.seed();
    }
}
