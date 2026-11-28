package com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review;

import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewFindingDetail;

import java.time.LocalDateTime;
import java.util.List;

public record AIReviewReportDetail(
        Long reportId,
        Long templateId,
        Long snapshotId,
        String status,
        String summary,
        LocalDateTime createdAt,
        List<AIReviewFindingDetail> findings
) {}