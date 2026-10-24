package com.example.starter_project_2025.system.project;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Retire previously generated menus/permissions for the removed, out-of-scope builder. */
@Component @Order(11) @RequiredArgsConstructor
public class WorkspaceModuleCleanup implements CommandLineRunner {
    private final JdbcTemplate jdbc;

    @Override @Transactional
    public void run(String... args) {
        jdbc.update("UPDATE modules SET is_active = FALSE WHERE url IN (?, ?) OR required_permission LIKE ?",
                "/management/project-templates", "/project-templates", "PROJECT_TEMPLATE_%");
        jdbc.update("UPDATE permissions SET is_active = FALSE WHERE resource = ?", "PROJECT_TEMPLATE");
        jdbc.update("UPDATE modules SET is_active = FALSE WHERE url = ?", "/management/project-teams");
    }
}
