package com.example.starter_project_2025.system.project.rubric.domain;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class RubricVersionTest {

    @Test
    void publishedVersionIsImmutable() {
        UUID actorId = UUID.randomUUID();
        Instant createdAt = Instant.parse("2026-01-01T00:00:00Z");
        Rubric rubric = Rubric.create(UUID.randomUUID(), UUID.randomUUID(), "Delivery", null, actorId, createdAt);
        RubricVersion version = RubricVersion.draft(UUID.randomUUID(), rubric, 1, actorId, createdAt);

        version.replaceDraft("Delivery", null, List.of(
                new RubricVersion.CriterionValue("QUALITY", "Quality", null,
                        new BigDecimal("60.00"), new BigDecimal("60.00"), 0),
                new RubricVersion.CriterionValue("DEADLINE", "Deadline", null,
                        new BigDecimal("40.00"), new BigDecimal("40.00"), 1)
        ), actorId, createdAt);

        Instant publishedAt = createdAt.plusSeconds(60);
        version.publish(actorId, publishedAt);

        assertEquals(RubricVersionStatus.PUBLISHED, version.getStatus());
        assertEquals(new BigDecimal("100.00"), version.getTotalMaxScore());
        assertEquals(publishedAt, version.getPublishedAt());
        assertThrows(IllegalStateException.class, () -> version.replaceDraft(
                "Changed", null, List.of(), actorId, publishedAt.plusSeconds(1)));
        assertThrows(IllegalStateException.class, () -> version.publish(actorId, publishedAt.plusSeconds(1)));
    }

    @Test
    void draftCanBeUpdatedBeforePublishing() {
        UUID actorId = UUID.randomUUID();
        Instant now = Instant.parse("2026-01-01T00:00:00Z");
        Rubric rubric = Rubric.create(UUID.randomUUID(), UUID.randomUUID(), "Draft", null, actorId, now);
        RubricVersion version = RubricVersion.draft(UUID.randomUUID(), rubric, 1, actorId, now);

        version.replaceDraft("Updated draft", "Still editable", List.of(
                new RubricVersion.CriterionValue("QUALITY", "Quality", null,
                        new BigDecimal("100.00"), new BigDecimal("10.00"), 0)
        ), actorId, now.plusSeconds(1));

        assertEquals(RubricVersionStatus.DRAFT, version.getStatus());
        assertEquals("Updated draft", version.getNameSnapshot());
        assertEquals(new BigDecimal("10.00"), version.getTotalMaxScore());
    }
}
