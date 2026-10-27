package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.dto.request.ChecklistItemRequest;
import com.example.starter_project_2025.system.project.milestone.dto.request.CreateMilestoneRequest;
import com.example.starter_project_2025.system.project.milestone.dto.request.LatePolicyRequest;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import com.example.starter_project_2025.system.project.milestone.integration.model.RubricCriterionData;
import com.example.starter_project_2025.system.project.milestone.integration.model.RubricSnapshotData;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class MilestoneValidatorTest {

    private final MilestoneValidator validator = new MilestoneValidator();
    private final Instant now = Instant.parse("2026-10-23T10:00:00Z");

    @Test
    void acceptsValidRequestAndExactOneHundredPercentRubric() {
        assertDoesNotThrow(() -> validator.validate(validRequest(), rubric("50.00", "50.00"), now));
    }

    @Test
    void rejectsDeadlineEqualToServerTime() {
        CreateMilestoneRequest base = validRequest();
        CreateMilestoneRequest request = new CreateMilestoneRequest(
                1L, base.title(), base.description(), now, base.mandatory(), base.checklist(),
                base.rubricSnapshotId(), base.reviewerId(), base.latePolicy());

        MilestoneValidationException ex = assertThrows(
                MilestoneValidationException.class,
                () -> validator.validate(request, rubric("50.00", "50.00"), now));
        assertTrue(ex.getErrors().containsKey("deadline"));
    }

    @Test
    void rejectsRubricTotalsOfNinetyNinePointNinetyNineAndOneHundredPointZeroOne() {
        MilestoneValidationException below = assertThrows(
                MilestoneValidationException.class,
                () -> validator.validate(validRequest(), rubric("50.00", "49.99"), now));
        MilestoneValidationException above = assertThrows(
                MilestoneValidationException.class,
                () -> validator.validate(validRequest(), rubric("50.00", "50.01"), now));
        assertTrue(below.getErrors().containsKey("rubric.totalWeight"));
        assertTrue(above.getErrors().containsKey("rubric.totalWeight"));
    }

    @Test
    void rejectsContradictoryNoLateConfiguration() {
        CreateMilestoneRequest base = validRequest();
        CreateMilestoneRequest request = new CreateMilestoneRequest(
                1L, base.title(), base.description(), base.deadline(), base.mandatory(), base.checklist(),
                base.rubricSnapshotId(), base.reviewerId(),
                new LatePolicyRequest(LatePolicyType.NO_LATE, base.deadline().plusSeconds(3600), BigDecimal.TEN));

        MilestoneValidationException ex = assertThrows(
                MilestoneValidationException.class,
                () -> validator.validate(request, rubric("50.00", "50.00"), now));
        assertTrue(ex.getErrors().containsKey("latePolicy.lateUntil"));
        assertTrue(ex.getErrors().containsKey("latePolicy.penaltyPercent"));
    }

    @Test
    void rejectsBlankChecklistAndDuplicateOrder() {
        CreateMilestoneRequest base = validRequest();
        CreateMilestoneRequest request = new CreateMilestoneRequest(
                1L, base.title(), base.description(), base.deadline(), base.mandatory(),
                List.of(
                        new ChecklistItemRequest("   ", true, 0),
                        new ChecklistItemRequest("Demo", true, 0)
                ),
                base.rubricSnapshotId(), base.reviewerId(), base.latePolicy());

        MilestoneValidationException ex = assertThrows(
                MilestoneValidationException.class,
                () -> validator.validate(request, rubric("50.00", "50.00"), now));
        assertTrue(ex.getErrors().containsKey("checklist[0].content"));
        assertTrue(ex.getErrors().containsKey("checklist[1].orderIndex"));
    }

    private CreateMilestoneRequest validRequest() {
        Instant deadline = now.plusSeconds(86400);
        return new CreateMilestoneRequest(
                1L, "Sprint delivery", "Description", deadline, true,
                List.of(new ChecklistItemRequest("Source code", true, 0)),
                UUID.randomUUID(), UUID.randomUUID(),
                new LatePolicyRequest(LatePolicyType.ALLOW_LATE, deadline.plusSeconds(3600), new BigDecimal("10.00"))
        );
    }

    private RubricSnapshotData rubric(String first, String second) {
        return new RubricSnapshotData(
                UUID.randomUUID(), "Rubric", "1.0", true,
                List.of(
                        new RubricCriterionData("A", "A", new BigDecimal(first), BigDecimal.ONE),
                        new RubricCriterionData("B", "B", new BigDecimal(second), BigDecimal.ONE)
                )
        );
    }
}
