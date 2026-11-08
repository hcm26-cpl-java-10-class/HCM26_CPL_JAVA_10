package com.example.starter_project_2025.system.demo.course_review;

import com.example.starter_project_2025.system.demo.course_review.dto.request.CourseReviewRequest;
import com.example.starter_project_2025.system.demo.course_review.dto.response.CourseReviewEligibilityResponse;
import com.example.starter_project_2025.system.demo.course_review.dto.response.CourseReviewResponse;
import com.example.starter_project_2025.system.demo.course_review.dto.response.CourseReviewSummaryResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/courses/{courseId}/reviews")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Course Reviews", description = "APIs for managing course reviews")
public class CourseReviewController {
    private final CourseReviewService reviewService;

    @PostMapping
    public ResponseEntity<CourseReviewResponse> create(
            @PathVariable Long courseId,
            @Valid @RequestBody CourseReviewRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(reviewService.createReview(courseId, request));
    }

    @PutMapping("/me")
    public ResponseEntity<CourseReviewResponse> update(
            @PathVariable Long courseId,
            @Valid @RequestBody CourseReviewRequest request
    ) {
        return ResponseEntity.ok(
                reviewService.updateMyReview(courseId, request)
        );
    }

    @DeleteMapping("/me")
    public ResponseEntity<Void> delete(
            @PathVariable Long courseId
    ) {
        reviewService.deleteMyReview(courseId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<Page<CourseReviewResponse>> getReviews(
            @PathVariable Long courseId,
            Pageable pageable
    ) {
        return ResponseEntity.ok(
                reviewService.getReviews(courseId, pageable)
        );
    }

    @GetMapping("/summary")
    public ResponseEntity<CourseReviewSummaryResponse> getSummary(
            @PathVariable Long courseId
    ) {
        return ResponseEntity.ok(
                reviewService.getReviewSummary(courseId)
        );
    }

    @GetMapping("/eligibility")
    public ResponseEntity<CourseReviewEligibilityResponse> getEligibility(
            @PathVariable Long courseId
    ) {
        return ResponseEntity.ok(
                reviewService.getEligibility(courseId)
        );
    }
}
