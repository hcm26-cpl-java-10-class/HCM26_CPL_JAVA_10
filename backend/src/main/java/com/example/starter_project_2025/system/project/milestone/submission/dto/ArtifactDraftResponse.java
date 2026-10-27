package com.example.starter_project_2025.system.project.milestone.submission.dto;

import java.time.Instant;
import java.util.Map;
import java.util.List;
import java.util.UUID;

public record ArtifactDraftResponse(
        UUID milestoneId,
        String status,
        String repositoryUrl,
        String deploymentUrl,
        String releaseNotes,
        Map<UUID, Boolean> checklist,
        List<ArtifactAttachmentResponse> attachments,
        long version,
        UUID createdBy,
        Instant createdAt,
        UUID updatedBy,
        Instant updatedAt
) { }
