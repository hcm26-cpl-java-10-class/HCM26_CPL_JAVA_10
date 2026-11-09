package com.example.starter_project_2025.system.project.milestone.submission.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ArtifactSubmissionResponse(
        UUID id, UUID milestoneId, long version, String status,
        String repositoryUrl, String deploymentUrl, String releaseNotes,
        Map<UUID, Boolean> checklist, List<ArtifactSubmissionAttachmentResponse> attachments,
        Instant submittedAt, boolean submittedLate, BigDecimal latePenaltyPercent
) { }
