package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import com.example.starter_project_2025.system.project.milestone.integration.model.RubricCriterionData;
import com.example.starter_project_2025.system.project.milestone.integration.model.RubricSnapshotData;
import com.example.starter_project_2025.system.project.milestone.integration.port.RubricCatalogPort;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
@Profile("!milestone-real-integrations")
public class MockRubricCatalogAdapter implements RubricCatalogPort {

    private final RubricSnapshotData rubric = new RubricSnapshotData(
            MockMilestoneData.RUBRIC_ID,
            "Milestone Delivery Rubric",
            "1.0",
            true,
            List.of(
                    new RubricCriterionData("FUNCTIONALITY", "Functionality", new BigDecimal("50.00"), new BigDecimal("5.00")),
                    new RubricCriterionData("QUALITY", "Code quality", new BigDecimal("30.00"), new BigDecimal("3.00")),
                    new RubricCriterionData("DOCUMENTATION", "Documentation", new BigDecimal("20.00"), new BigDecimal("2.00"))
            )
    );

    @Override
    public List<RubricSnapshotData> findAllowedRubrics(UUID projectId, UUID actorId, UUID tenantId) {
        return List.of(rubric);
    }

    @Override
    public RubricSnapshotData requireAllowedSnapshot(
            UUID rubricSnapshotId, UUID projectId, UUID actorId, UUID tenantId) {
        if (!rubric.active() || !rubric.id().equals(rubricSnapshotId)) {
            throw new MilestoneValidationException(Map.of(
                    "rubricSnapshotId", List.of("Rubric is not available")
            ));
        }
        return rubric;
    }
}
