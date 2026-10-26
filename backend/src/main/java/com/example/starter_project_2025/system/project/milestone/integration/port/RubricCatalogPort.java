package com.example.starter_project_2025.system.project.milestone.integration.port;

import com.example.starter_project_2025.system.project.milestone.integration.model.RubricSnapshotData;

import java.util.List;
import java.util.UUID;

public interface RubricCatalogPort {
    List<RubricSnapshotData> findAllowedRubrics(Long projectId, UUID actorId, Long tenantId);

    RubricSnapshotData requireAllowedSnapshot(
            UUID rubricSnapshotId, Long projectId, UUID actorId, Long tenantId);

    RubricSnapshotData requireSnapshotForRead(
            UUID rubricSnapshotId, Long projectId, Long tenantId);
}
