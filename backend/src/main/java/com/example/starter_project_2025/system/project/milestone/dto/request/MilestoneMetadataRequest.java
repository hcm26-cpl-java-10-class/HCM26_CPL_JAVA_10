package com.example.starter_project_2025.system.project.milestone.dto.request;

import java.time.Instant;

public record MilestoneMetadataRequest(String title, String description, Instant deadline, long expectedVersion,
                                       java.util.UUID rubricSnapshotId) { }
