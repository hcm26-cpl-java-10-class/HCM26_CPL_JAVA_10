package com.example.starter_project_2025.system.project.milestone.submission.port;

import java.util.UUID;

/** Confirms that the authenticated student is assigned to the project in the active tenant. */
public interface ArtifactSubmissionScopePort {
    void requireStudentProjectAccess(Long projectId, UUID actorId, Long tenantId);
}
