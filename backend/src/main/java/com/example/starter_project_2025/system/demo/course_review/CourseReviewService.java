package com.example.starter_project_2025.system.demo.course_review;

import com.example.starter_project_2025.system.demo.course_review.dto.request.CourseReviewRequest;
import com.example.starter_project_2025.system.demo.course_review.dto.response.CourseReviewEligibilityResponse;
import com.example.starter_project_2025.system.demo.course_review.dto.response.CourseReviewResponse;
import com.example.starter_project_2025.system.demo.course_review.dto.response.CourseReviewSummaryResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface CourseReviewService {
    CourseReviewResponse createReview(Long courseId, CourseReviewRequest request);
    CourseReviewResponse updateMyReview(Long courseId, CourseReviewRequest request);
    void deleteMyReview(Long courseId);
    Page<CourseReviewResponse> getReviews(Long courseId, Pageable pageable);
    CourseReviewSummaryResponse getReviewSummary(Long courseId);
    CourseReviewEligibilityResponse getEligibility(Long courseId);
}