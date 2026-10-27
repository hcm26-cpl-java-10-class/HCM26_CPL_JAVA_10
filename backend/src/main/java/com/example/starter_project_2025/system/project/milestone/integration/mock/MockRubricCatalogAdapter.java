package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneDependencyException;
import com.example.starter_project_2025.system.project.milestone.integration.model.RubricCriterionData;
import com.example.starter_project_2025.system.project.milestone.integration.model.RubricSnapshotData;
import com.example.starter_project_2025.system.project.milestone.integration.port.RubricCatalogPort;
import com.example.starter_project_2025.system.project.rubric.service.RubricCatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@Profile("milestone-mock | milestone-rubric-mock")
@RequiredArgsConstructor
public class MockRubricCatalogAdapter implements RubricCatalogPort {
    private final RubricCatalogService catalog;

    private final List<RubricSnapshotData> rubrics = List.of(
            new RubricSnapshotData(
                    MockMilestoneData.RUBRIC_ID,
                    "Milestone Delivery Rubric",
                    "1.0",
                    true,
                    List.of(
                            new RubricCriterionData("FUNCTIONALITY", "Functionality", new BigDecimal("50.00"), new BigDecimal("5.00")),
                            new RubricCriterionData("QUALITY", "Code quality", new BigDecimal("30.00"), new BigDecimal("3.00")),
                            new RubricCriterionData("DOCUMENTATION", "Documentation", new BigDecimal("20.00"), new BigDecimal("2.00"))
                    )
            ),
            new RubricSnapshotData(
                    MockMilestoneData.PRESENTATION_RUBRIC_ID,
                    "Demo and Presentation Rubric",
                    "2.0",
                    true,
                    List.of(
                            new RubricCriterionData("DEMO", "Product demonstration", new BigDecimal("40.00"), new BigDecimal("4.00")),
                            new RubricCriterionData("COMMUNICATION", "Communication", new BigDecimal("35.00"), new BigDecimal("3.50")),
                            new RubricCriterionData("QNA", "Question handling", new BigDecimal("25.00"), new BigDecimal("2.50"))
                    )
            ),
            new RubricSnapshotData(
                    MockMilestoneData.DOCUMENTATION_RUBRIC_ID,
                    "Technical Documentation Rubric",
                    "1.1",
                    true,
                    List.of(
                            new RubricCriterionData("COMPLETENESS", "Completeness", new BigDecimal("45.00"), new BigDecimal("4.50")),
                            new RubricCriterionData("ACCURACY", "Technical accuracy", new BigDecimal("35.00"), new BigDecimal("3.50")),
                            new RubricCriterionData("CLARITY", "Clarity and structure", new BigDecimal("20.00"), new BigDecimal("2.00"))
                    )
            )
    );

    @Override
    public List<RubricSnapshotData> findAllowedRubrics(Long projectId, UUID actorId, Long tenantId) {
        List<RubricSnapshotData> published = catalog.findPublished(tenantId).stream()
                .map(RubricCatalogService::snapshot).toList();
        return published.isEmpty() && MockMilestoneData.TENANT_ID.equals(tenantId) ? rubrics : published;
    }

    @Override
    public RubricSnapshotData requireAllowedSnapshot(
            UUID rubricSnapshotId, Long projectId, UUID actorId, Long tenantId) {
        var published = catalog.findPublished(rubricSnapshotId, tenantId);
        if (published.isPresent()) return RubricCatalogService.snapshot(published.get());
        if (!MockMilestoneData.TENANT_ID.equals(tenantId)) {
            throw new MilestoneValidationException(Map.of("rubricSnapshotId", List.of("Rubric is not available")));
        }
        return rubrics.stream()
                .filter(rubric -> rubric.active() && rubric.id().equals(rubricSnapshotId))
                .findFirst()
                .orElseThrow(() -> new MilestoneValidationException(Map.of(
                        "rubricSnapshotId", List.of("Rubric is not available")
                )));
    }

    @Override
    public RubricSnapshotData requireSnapshotForRead(
            UUID rubricSnapshotId, Long projectId, Long tenantId) {
        var published = catalog.findPublished(rubricSnapshotId, tenantId);
        if (published.isPresent()) return RubricCatalogService.snapshot(published.get());
        if (!MockMilestoneData.TENANT_ID.equals(tenantId)) {
            throw new MilestoneDependencyException("Milestone rubric snapshot could not be loaded");
        }
        return rubrics.stream()
                .filter(rubric -> rubric.id().equals(rubricSnapshotId))
                .findFirst()
                .orElseThrow(() -> new MilestoneDependencyException(
                        "Milestone rubric snapshot could not be loaded"));
    }
}
