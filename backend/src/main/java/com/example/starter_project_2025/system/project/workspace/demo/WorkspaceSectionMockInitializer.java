package com.example.starter_project_2025.system.project.workspace.demo;

import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceSectionDtos;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.project.workspace.service.MockWorkspaceSectionDataSource;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import javax.sql.DataSource;

@Component @Order(30) @Profile("!test") @RequiredArgsConstructor
@ConditionalOnProperty(name = "app.workspace.sections.mock-fixtures.enabled", havingValue = "true")
public class WorkspaceSectionMockInitializer implements CommandLineRunner {
    private final WorkspaceRepository workspaces;
    private final MockWorkspaceSectionDataSource mock;
    private final DataSource dataSource;
    @Override @Transactional
    public void run(String... args) throws Exception {
        try (var connection = dataSource.getConnection()) {
            if (!connection.getMetaData().getURL().startsWith("jdbc:h2:")) return;
        }
        workspaces.findAll().stream()
                .filter(workspace -> workspace.getProject().getCode().startsWith("WS-DEMO-"))
                .forEach(workspace -> mock.seed(WorkspaceSectionDtos.Scope.from(workspace)));
    }
}
