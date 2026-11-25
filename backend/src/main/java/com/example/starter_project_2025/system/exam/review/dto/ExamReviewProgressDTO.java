package com.example.starter_project_2025.system.exam.review.dto;

import com.example.starter_project_2025.system.exam.review.domain.ExamReviewStatus;
import com.example.starter_project_2025.system.exam.review.domain.ExamReviewType;

import java.time.Instant;

/**
 * Một dòng trong bảng tiến độ phân công (teacher view).
 */
public record ExamReviewProgressDTO(
        Long assignmentId,
        Long attemptId,
        int attemptNumber,
        String authorName,
        ExamReviewType reviewType,
        ExamReviewStatus status,
        String reviewerName,
        Instant assignedAt,
        Instant submittedAt
) {
}
