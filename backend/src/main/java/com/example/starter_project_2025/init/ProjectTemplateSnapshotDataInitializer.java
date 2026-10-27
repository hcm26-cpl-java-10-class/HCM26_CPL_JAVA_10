package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds sample {@link ProjectTemplateSnapshot} rows, following the same
 * idempotent upsert pattern used by {@link SprintDataInitializer}.
 * <p>
 * Runs after the RBAC/user seeders so the data is available as soon as the
 * application starts, and can safely run on every startup (existing rows are
 * updated instead of duplicated). Rows are keyed by
 * {@code (templateId, version)}, which matches the unique constraint
 * {@code uk_project_template_version} of the entity.
 * <p>
 * {@code templateId} / {@code projectId} are plain identifiers: the owning
 * modules are owned by other teams, so the sample rows only need to be stable
 * and consistent with each other.
 * <p>
 * Every sample row is stored as {@link ProjectTemplateVersionStatus#PUBLISHED}
 * and, from the second version of a template on, keeps
 * {@code parentTemplateId} pointing at the version it was derived from so the
 * history shown by the workspace is traceable (US-07).
 */
@Slf4j
@Order(14)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectTemplateSnapshotDataInitializer implements CommandLineRunner {

    ProjectTemplateSnapshotRepository snapshotRepository;

    @Override
    @Transactional
    public void run(String... args) {

        // Template 1 - Student Project Template (three published versions).
        ProjectTemplateSnapshot template1V1 = upsertSnapshot(
                1L,
                1L,
                "v1.0",
                null,
                """
                        {
                          "name": "Student Project Template",
                          "description": "Baseline structure for a 15-week student project",
                          "sections": ["Overview", "Scope", "Deliverables"],
                          "estimatedWeeks": 15
                        }
                        """
        );

        ProjectTemplateSnapshot template1V11 = upsertSnapshot(
                1L,
                1L,
                "v1.1",
                template1V1.getId(),
                """
                        {
                          "name": "Student Project Template",
                          "description": "Adds the risk register and the weekly report section",
                          "sections": ["Overview", "Scope", "Deliverables", "Risk Register", "Weekly Report"],
                          "estimatedWeeks": 15
                        }
                        """
        );

        upsertSnapshot(
                1L,
                1L,
                "v2.0",
                template1V11.getId(),
                """
                        {
                          "name": "Student Project Template",
                          "description": "Capstone ready template with review gates",
                          "sections": ["Overview", "Scope", "Deliverables", "Risk Register", "Weekly Report", "Review Gates"],
                          "estimatedWeeks": 15,
                          "reviewGates": ["Proposal", "Midterm", "Final"]
                        }
                        """
        );

        // Template 2 - Capstone Template (project 2).
        upsertSnapshot(
                2L,
                2L,
                "v1.0",
                null,
                """
                        {
                          "name": "Capstone Project Template",
                          "description": "Structure for the two semester capstone project",
                          "sections": ["Overview", "Milestones", "Deliverables"],
                          "estimatedWeeks": 30
                        }
                        """
        );

        // Template 3 - Team Project Template (project 3).
        upsertSnapshot(
                3L,
                3L,
                "v1.0",
                null,
                """
                        {
                          "name": "Team Project Template",
                          "description": "Self organised team project with sprint checkpoints",
                          "sections": ["Overview", "Team Charter", "Sprint Plan"],
                          "estimatedWeeks": 10,
                          "sprints": 3
                        }
                        """
        );

        log.info("Ensured sample project template version data.");
    }

    private ProjectTemplateSnapshot upsertSnapshot(
            Long templateId,
            Long projectId,
            String version,
            Long parentTemplateId,
            String contentJson
    ) {

        ProjectTemplateSnapshot snapshot = snapshotRepository
                .findFirstByTemplateIdAndVersion(templateId, version)
                .orElseGet(ProjectTemplateSnapshot::new);

        snapshot.setTemplateId(templateId);
        snapshot.setProjectId(projectId);
        snapshot.setVersion(version);
        snapshot.setParentTemplateId(parentTemplateId);
        snapshot.setStatus(ProjectTemplateVersionStatus.PUBLISHED);
        snapshot.setContentJson(contentJson);
        snapshot.setIsActive(true);

        return snapshotRepository.save(snapshot);
    }
}
