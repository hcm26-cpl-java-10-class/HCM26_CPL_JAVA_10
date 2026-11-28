package com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review;

import java.time.LocalDateTime;

public record AIReviewReportListItem(
        Long reportId,
        Long snapshotId,
        String status,
        String summary,
        LocalDateTime createdAt
) {}