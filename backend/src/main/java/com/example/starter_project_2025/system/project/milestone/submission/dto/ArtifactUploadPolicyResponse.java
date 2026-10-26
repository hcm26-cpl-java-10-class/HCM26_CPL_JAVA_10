package com.example.starter_project_2025.system.project.milestone.submission.dto;

import java.util.Set;

public record ArtifactUploadPolicyResponse(boolean enabled, long maxBytes, Set<String> allowedMimeTypes) { }
