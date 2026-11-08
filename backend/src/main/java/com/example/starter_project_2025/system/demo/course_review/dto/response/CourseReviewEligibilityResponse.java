package com.example.starter_project_2025.system.demo.course_review.dto.response;

public record CourseReviewEligibilityResponse(
        boolean completed,
        boolean canReview,
        boolean hasReviewed,
        CourseReviewResponse myReview
) {}
