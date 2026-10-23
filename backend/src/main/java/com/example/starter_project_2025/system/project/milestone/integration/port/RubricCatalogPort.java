package com.example.starter_project_2025.system.project.milestone.integration.port;

import com.example.starter_project_2025.system.project.milestone.integration.model.RubricSnapshotData;

import java.util.List;
import java.util.UUID;

public interface RubricCatalogPort {
    List<RubricSnapshotData> findAllowedRubrics(UUID projectId, UUID actorId, UUID tenantId);

    RubricSnapshotData requireAllowedSnapshot(
            UUID rubricSnapshotId, UUID projectId, UUID actorId, UUID tenantId);
}
