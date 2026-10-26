package com.example.starter_project_2025.system.project.rubric.integration;

import com.example.starter_project_2025.system.project.milestone.exception.*;
import com.example.starter_project_2025.system.project.milestone.integration.model.*;
import com.example.starter_project_2025.system.project.milestone.integration.port.RubricCatalogPort;
import com.example.starter_project_2025.system.project.rubric.domain.*;
import com.example.starter_project_2025.system.project.rubric.repository.RubricVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
@Profile("!milestone-rubric-mock")
@RequiredArgsConstructor
public class JpaRubricCatalogAdapter implements RubricCatalogPort {
    private final RubricVersionRepository repository;

    @Override
    public List<RubricSnapshotData> findAllowedRubrics(Long projectId, UUID actorId, Long tenantId) {
        return repository.findAllByRubricTenantIdAndStatusOrderByNameSnapshotAscVersionNumberDesc(
                tenantAlias(tenantId), RubricVersionStatus.PUBLISHED).stream().map(this::map).toList();
    }

    @Override
    public RubricSnapshotData requireAllowedSnapshot(UUID id, Long projectId, UUID actorId, Long tenantId) {
        RubricVersion version = repository.findByIdAndRubricTenantId(id, tenantAlias(tenantId))
                .filter(item -> item.getStatus() == RubricVersionStatus.PUBLISHED)
                .orElseThrow(() -> new MilestoneValidationException(Map.of(
                        "rubricSnapshotId", List.of("Rubric is not available"))));
        return map(version);
    }

    @Override
    public RubricSnapshotData requireSnapshotForRead(UUID id, Long projectId, Long tenantId) {
        return repository.findByIdAndRubricTenantId(id, tenantAlias(tenantId))
                .filter(item -> item.getStatus() == RubricVersionStatus.PUBLISHED)
                .map(this::map)
                .orElseThrow(() -> new MilestoneDependencyException("Milestone rubric version could not be loaded"));
    }

    private UUID tenantAlias(Long tenantId) {
        if (Long.valueOf(1L).equals(tenantId)) {
            return UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        }
        return UUID.nameUUIDFromBytes(("milestone:tenant:" + tenantId).getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    private RubricSnapshotData map(RubricVersion version) {
        return new RubricSnapshotData(version.getId(), version.getNameSnapshot(),
                "v" + version.getVersionNumber(), version.getStatus() == RubricVersionStatus.PUBLISHED,
                version.getCriteria().stream().map(c -> new RubricCriterionData(
                        c.getCode(), c.getName(), c.getWeight(), c.getMaxScore(), c.getRatings().stream()
                                .map(r -> new RubricRatingData(r.getLevel().name(), r.getPercentage(),
                                        r.getDescription(), r.getOrderIndex())).toList())).toList());
    }
}
