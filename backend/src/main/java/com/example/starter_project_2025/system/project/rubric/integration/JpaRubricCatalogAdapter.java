package com.example.starter_project_2025.system.project.rubric.integration;

import com.example.starter_project_2025.system.project.milestone.exception.*;
import com.example.starter_project_2025.system.project.milestone.integration.model.*;
import com.example.starter_project_2025.system.project.milestone.integration.port.RubricCatalogPort;
import com.example.starter_project_2025.system.project.rubric.domain.*;
import com.example.starter_project_2025.system.project.rubric.service.RubricCatalogService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.util.*;

@Component
@Profile("milestone-real-integrations")
@RequiredArgsConstructor
public class JpaRubricCatalogAdapter implements RubricCatalogPort {
    private final RubricCatalogService catalog;

    @Override
    public List<RubricSnapshotData> findAllowedRubrics(Long projectId, UUID actorId, Long tenantId) {
        return catalog.findPublished(tenantId).stream().map(RubricCatalogService::snapshot).toList();
    }

    @Override
    public RubricSnapshotData requireAllowedSnapshot(UUID id, Long projectId, UUID actorId, Long tenantId) {
        RubricVersion version = catalog.findPublished(id, tenantId)
                .orElseThrow(() -> new MilestoneValidationException(Map.of(
                        "rubricSnapshotId", List.of("Rubric is not available"))));
        return RubricCatalogService.snapshot(version);
    }

    @Override
    public RubricSnapshotData requireSnapshotForRead(UUID id, Long projectId, Long tenantId) {
        return catalog.findPublished(id, tenantId)
                .map(RubricCatalogService::snapshot)
                .orElseThrow(() -> new MilestoneDependencyException("Milestone rubric version could not be loaded"));
    }

}
