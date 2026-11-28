package com.example.starter_project_2025.system.project.milestone.submission.dto;

import java.util.UUID;

public record ArtifactSubmissionAttachmentResponse(
        UUID id, String fileName, String contentType, long sizeBytes
) { }
