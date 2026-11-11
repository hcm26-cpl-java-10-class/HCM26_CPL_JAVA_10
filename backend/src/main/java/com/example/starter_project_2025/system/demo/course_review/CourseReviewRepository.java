package com.example.starter_project_2025.system.demo.course_review;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.demo.course_review.dto.response.CourseReviewStats;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CourseReviewRepository
        extends BaseCrudRepository<CourseReview, Long> {

    Optional<CourseReview> findByCourseIdAndUserId(Long courseId, Long studentId);

    boolean existsByCourseIdAndUserId(Long courseId, Long userId);

    Page<CourseReview> findByCourseId(Long courseId, Pageable pageable);

    @Query("""
        SELECT AVG(r.rating)
        FROM CourseReview r
        WHERE r.course.id = :courseId
    """)
    Double getAverageRating(@Param("courseId") Long courseId);

    @Query("""
        SELECT COUNT(r)
        FROM CourseReview r
        WHERE r.course.id = :courseId
    """)
    Long countReviews(@Param("courseId") Long courseId);

    @Query("""
        SELECT r.rating, COUNT(r)
        FROM CourseReview r
        WHERE r.course.id = :courseId
        GROUP BY r.rating
    """)
    List<Object[]> getRatingDistribution(@Param("courseId") Long courseId);

    @Query("""
        SELECT new com.example.starter_project_2025.system.demo.course_review.dto.response.CourseReviewStats(
            r.course.id,
            AVG(r.rating),
            COUNT(r)
        )
        FROM CourseReview r
        WHERE r.course.id IN :courseIds
        GROUP BY r.course.id
    """)
    List<CourseReviewStats> findStatsByCourseIds(
            @Param("courseIds") Collection<Long> courseIds
    );
}