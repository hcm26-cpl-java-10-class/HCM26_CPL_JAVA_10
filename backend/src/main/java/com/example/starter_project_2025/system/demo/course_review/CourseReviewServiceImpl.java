package com.example.starter_project_2025.system.demo.course_review;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course_review.dto.request.CourseReviewRequest;
import com.example.starter_project_2025.system.demo.course_review.dto.response.CourseReviewEligibilityResponse;
import com.example.starter_project_2025.system.demo.course_review.dto.response.CourseReviewResponse;
import com.example.starter_project_2025.system.demo.course_review.dto.response.CourseReviewSummaryResponse;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgressDTO;
import com.example.starter_project_2025.system.demo.progress.LessonProgressService;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.Map;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class CourseReviewServiceImpl implements CourseReviewService {
    private final CourseReviewRepository reviewRepository;
    private final CourseRepository courseRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final LessonProgressService lessonProgressService;
    private final CourseReviewMapper mapper;

    @Override
    public CourseReviewResponse createReview(Long courseId, CourseReviewRequest request) {
        User student = getCurrentUser();

        if (!hasCompletedCourse(student.getId(), courseId)) {
            throw new ResponseStatusException(
                    HttpStatus.FORBIDDEN,
                    "You must complete the course before reviewing"
            );
        }

        if (reviewRepository.existsByCourseIdAndUserId(courseId, student.getId())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "You have already reviewed this course"
            );
        }

        Course course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Course not found"
                ));

        CourseReview review = CourseReview.builder()
                .course(course)
                .user(student)
                .rating(request.getRating())
                .comment(request.getComment())
                .build();

        return mapper.toResponse(reviewRepository.save(review));
    }

    @Override
    public CourseReviewResponse updateMyReview(Long courseId, CourseReviewRequest request) {
        User student = getCurrentUser();

        CourseReview review = reviewRepository.findByCourseIdAndUserId(courseId, student.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Review not found"
                ));

        review.setRating(request.getRating());
        review.setComment(request.getComment());

        return mapper.toResponse(reviewRepository.save(review));
    }

    @Override
    public void deleteMyReview(Long courseId) {
        User student = getCurrentUser();

        CourseReview review = reviewRepository.findByCourseIdAndUserId(courseId, student.getId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Review not found"
                ));

        reviewRepository.delete(review);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<CourseReviewResponse> getReviews(Long courseId, Pageable pageable) {
        return reviewRepository
                .findByCourseId(courseId, pageable)
                .map(mapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public CourseReviewSummaryResponse getReviewSummary(Long courseId) {
        Double average = reviewRepository.getAverageRating(courseId);
        Long totalReviews = reviewRepository.countReviews(courseId);

        Map<Integer, Long> distribution = new HashMap<>();

        for (int rating = 1; rating <= 5; rating++) {
            distribution.put(rating, 0L);
        }

        for (Object[] row : reviewRepository.getRatingDistribution(courseId)) {
            Integer rating = (Integer) row[0];
            Long count = (Long) row[1];
            distribution.put(rating, count);
        }

        return new CourseReviewSummaryResponse(
                courseId,
                average == null ? 0.0 : Math.round(average * 10.0) / 10.0,
                totalReviews,
                distribution
        );
    }

    @Override
    @Transactional(readOnly = true)
    public CourseReviewEligibilityResponse getEligibility(Long courseId) {
        User student = getCurrentUser();

        boolean completed = hasCompletedCourse(student.getId(), courseId);

        CourseReview review = reviewRepository.findByCourseIdAndUserId(courseId, student.getId())
                .orElse(null);

        boolean hasReviewed = review != null;

        return new CourseReviewEligibilityResponse(
                completed,
                completed && !hasReviewed,
                hasReviewed,
                review == null ? null : mapper.toResponse(review)
        );
    }

    private boolean hasCompletedCourse(Long userId, Long courseId) {
        CourseEnrollment enrollment = enrollmentRepository
                .findByUser_IdAndCourse_Id(userId, courseId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "You are not enrolled in this course"
                ));

        LessonProgressDTO progress = lessonProgressService.getProgress(userId, enrollment.getId());

        return progress.progressPercentage() == 100;
    }

    private User getCurrentUser() {
        Authentication authentication =
                SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Unauthenticated"
            );
        }

        return principal.getUser();
    }
}