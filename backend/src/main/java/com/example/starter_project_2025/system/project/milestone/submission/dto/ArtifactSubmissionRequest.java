package com.example.starter_project_2025.system.project.milestone.submission.dto;

import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record ArtifactSubmissionRequest(
        @Size(max = 2048) String repositoryUrl,
        @Size(max = 2048) String deploymentUrl,
        String releaseNotes,
        Map<UUID, Boolean> checklist,
        List<UUID> attachmentIds
) { }
