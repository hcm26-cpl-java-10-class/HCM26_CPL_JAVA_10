package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(16)
@Profile("!prod")
@ConditionalOnProperty(prefix = "app.seed.team-allocation", name = "enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
public class ProjectTemplateSnapshotDataInitializer implements CommandLineRunner {
    private final ProjectTemplateRepository templates;
    private final ProjectTemplateSnapshotService versions;

    @Override
    @Transactional
    public void run(String... args) {
        templates.findAll().stream().filter(template -> Boolean.TRUE.equals(template.getIsActive())
                && template.getStatus() != com.example.starter_project_2025.system.project.template.ProjectTemplateStatus.ARCHIVED
                && !"MANUAL-GROUPING-DEFAULT".equals(template.getCode()))
                .forEach(versions::createInitialVersion);
    }
}
