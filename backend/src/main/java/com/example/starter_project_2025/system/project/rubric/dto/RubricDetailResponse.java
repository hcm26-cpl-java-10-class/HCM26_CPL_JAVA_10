package com.example.starter_project_2025.system.project.rubric.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RubricDetailResponse(UUID id, String name, String description,
                                   List<RubricVersionResponse> versions,
                                   Instant createdAt, Instant updatedAt, long lockVersion) {}
