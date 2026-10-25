package com.example.starter_project_2025.system.project;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Align existing Planning projects with the workspace activation rule. */
@Component
@Order(19)
@RequiredArgsConstructor
public class WorkspaceProjectStatusInitializer implements CommandLineRunner {
    private final ProjectRepository projects;

    @Override
    @Transactional
    public void run(String... args) {
        projects.activateProjectsWithWorkspace();
    }
}
