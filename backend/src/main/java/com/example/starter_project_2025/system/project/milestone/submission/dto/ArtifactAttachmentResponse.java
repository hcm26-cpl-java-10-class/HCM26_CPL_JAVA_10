package com.example.starter_project_2025.system.project.milestone.submission.dto;

import java.time.Instant;
import java.util.UUID;

public record ArtifactAttachmentResponse(UUID id, String fileName, String contentType,
        long sizeBytes, String scanStatus, UUID uploadedBy, Instant uploadedAt, long draftVersion) { }
