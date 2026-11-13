package com.example.starter_project_2025.system.project.template.assignment.hierarchy.demo;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

@Component
@Order(40)
@Profile("!prod & !test")
@ConditionalOnProperty(name = "app.project.hierarchy-demo.enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class HierarchyDemoDataInitializer implements CommandLineRunner {
    private final DataSource dataSource;
    private final HierarchyDemoFiles files;
    private final HierarchyDemoDataService demo;

    @Override
    public void run(String... args) throws Exception {
        try (var connection = dataSource.getConnection()) {
            if (!connection.getMetaData().getURL().startsWith("jdbc:h2:file:")) return;
        }
        files.prepareSamples();
        demo.seed();
    }
}
