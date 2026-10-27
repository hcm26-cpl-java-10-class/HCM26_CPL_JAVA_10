package com.example.starter_project_2025.system.project;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component @Order(11) @RequiredArgsConstructor
public class WorkspaceModuleCleanup implements CommandLineRunner {
    private final JdbcTemplate jdbc;

    @Override @Transactional
    public void run(String... args) {
        jdbc.update("UPDATE modules SET is_active = FALSE WHERE url IN (?, ?)",
                "/management/project-templates", "/management/project-teams");
    }
}
