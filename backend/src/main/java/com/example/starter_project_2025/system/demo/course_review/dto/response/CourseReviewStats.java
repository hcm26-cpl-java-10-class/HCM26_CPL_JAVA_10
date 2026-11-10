package com.example.starter_project_2025.system.demo.course_review.dto.response;

public record CourseReviewStats(
        Long courseId,
        Double averageRating,
        Long totalReviews
) {}