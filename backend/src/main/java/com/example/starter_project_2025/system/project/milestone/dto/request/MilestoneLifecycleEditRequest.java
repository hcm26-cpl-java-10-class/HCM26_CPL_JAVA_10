package com.example.starter_project_2025.system.project.milestone.dto.request;

import java.time.Instant;

public record MilestoneLifecycleEditRequest(Long expectedVersion, String description, Instant deadline) { }
