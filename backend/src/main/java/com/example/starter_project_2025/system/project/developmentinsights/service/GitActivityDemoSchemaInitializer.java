package com.example.starter_project_2025.system.project.developmentinsights.service;

import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Creates only Git fixture metadata; the referenced business tables remain unchanged. */
@Component
@Order(Ordered.LOWEST_PRECEDENCE - 1)
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.git-activity.demo.enabled", havingValue = "true", matchIfMissing = true)
public class GitActivityDemoSchemaInitializer implements ApplicationRunner {
    private final DataSource dataSource;
    private final JdbcTemplate jdbc;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        try (var connection = dataSource.getConnection()) {
            if (!"H2".equalsIgnoreCase(connection.getMetaData().getDatabaseProductName())) return;
        }
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS git_activity_demo_sprint (
                    project_id BIGINT PRIMARY KEY,
                    repository_id BIGINT NOT NULL,
                    report_sprint_id BIGINT,
                    empty_sprint_id BIGINT,
                    CONSTRAINT fk_git_demo_sprint_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                    CONSTRAINT fk_git_demo_sprint_repository FOREIGN KEY (repository_id) REFERENCES git_repository(id) ON DELETE CASCADE,
                    CONSTRAINT fk_git_demo_sprint_report FOREIGN KEY (report_sprint_id) REFERENCES sprint(sprint_id) ON DELETE SET NULL,
                    CONSTRAINT fk_git_demo_sprint_empty FOREIGN KEY (empty_sprint_id) REFERENCES sprint(sprint_id) ON DELETE SET NULL
                )
                """);
    }
}
