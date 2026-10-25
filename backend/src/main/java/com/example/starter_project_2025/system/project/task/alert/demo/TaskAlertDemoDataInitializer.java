package com.example.starter_project_2025.system.project.task.alert.demo;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import javax.sql.DataSource;

@Slf4j @Component @Order(21) @Profile("!test & !prod")
@ConditionalOnProperty(name = "app.task-alert.demo.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class TaskAlertDemoDataInitializer implements CommandLineRunner {
    private final TaskAlertDemoDataService demo;
    private final DataSource dataSource;
    @Override public void run(String... args) throws Exception {
        try (var connection = dataSource.getConnection()) {
            if (!connection.getMetaData().getURL().startsWith("jdbc:h2:")) return;
        }
        try { demo.seed(); }
        catch (IllegalStateException exception) {
            log.warn("Task alert demo setup was skipped: {}", exception.getMessage()); return;
        }
        log.info("Task alert demo data is ready. Select Task Alert Demo on the Tasks page.");
    }
}
