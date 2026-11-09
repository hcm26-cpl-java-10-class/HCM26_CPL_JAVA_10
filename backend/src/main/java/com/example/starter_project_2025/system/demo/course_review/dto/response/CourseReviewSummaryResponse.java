package com.example.starter_project_2025.system.demo.course_review.dto.response;

import java.util.Map;

public record CourseReviewSummaryResponse(
        Long courseId,
        Double averageRating,
        Long totalReviews,
        Map<Integer, Long> ratingDistribution
) {}