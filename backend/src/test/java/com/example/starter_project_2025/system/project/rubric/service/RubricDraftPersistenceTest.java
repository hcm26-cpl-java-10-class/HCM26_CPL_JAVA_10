package com.example.starter_project_2025.system.project.rubric.service;

import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentTenantProvider;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.rubric.domain.RubricRatingLevel;
import com.example.starter_project_2025.system.project.rubric.dto.RubricCriterionRequest;
import com.example.starter_project_2025.system.project.rubric.dto.RubricRatingRequest;
import com.example.starter_project_2025.system.project.rubric.dto.SaveRubricDraftRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@DataJpaTest
@Import(RubricService.class)
class RubricDraftPersistenceTest {
    @Autowired RubricService service;
    @Autowired JdbcTemplate jdbc;
    @MockBean MilestoneRepository milestones;
    @MockBean CurrentTenantProvider tenantProvider;
    @MockBean CurrentActorProvider actorProvider;
    @MockBean Clock clock;

    private final UUID tenantId = UUID.randomUUID();
    private final UUID actorId = UUID.randomUUID();

    @BeforeEach
    void actor() {
        when(tenantProvider.requireCurrentTenantId()).thenReturn(tenantId);
        when(actorProvider.requireCurrentActorId()).thenReturn(actorId);
        when(clock.instant()).thenReturn(Instant.parse("2026-10-28T00:00:00Z"));
    }

    @Test
    void savesExistingDraftWithTheSameCriterionCodeAndOrder() {
        var created = service.create(draft("Original criterion"));
        UUID versionId = created.versions().getFirst().id();

        var updated = service.updateDraft(created.id(), versionId, draft("Updated criterion"));

        assertEquals("Updated criterion", updated.versions().getFirst().criteria().getFirst().name());
        assertEquals(1L, jdbc.queryForObject(
                "SELECT COUNT(*) FROM rubric_criteria WHERE rubric_version_id=? AND code='SDFSDF'",
                Long.class, versionId));
    }

    private SaveRubricDraftRequest draft(String criterionName) {
        var ratings = Arrays.stream(RubricRatingLevel.values())
                .map(level -> new RubricRatingRequest(level, level.name() + " guidance"))
                .toList();
        return new SaveRubricDraftRequest("Delivery rubric", null, List.of(
                new RubricCriterionRequest("SDFSDF", criterionName, null,
                        new BigDecimal("100.00"), new BigDecimal("10.00"), 0, ratings)));
    }
}
