package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course_review.CourseReview;
import com.example.starter_project_2025.system.demo.certificate.Certificate;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.progress.LessonProgress;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Các query tổng hợp cho Course Analytics. Dùng JpaRepository của CourseEnrollment làm "mỏ neo",
 * các query khác join sang entity khác bằng JPQL.
 */
@Repository
public interface CourseAnalyticsRepository extends JpaRepository<CourseEnrollment, Long> {

    // ---- Learners ----

    @Query("""
            select count(e) from CourseEnrollment e
            where e.course.id = :courseId and e.isActive = true
            """)
    long countActiveLearners(@Param("courseId") Long courseId);

    // ---- 1. Funnel ----

    /** [lessonId, số học viên đã bắt đầu, số học viên đã hoàn thành] */
    @Query("""
            select p.lesson.id, count(p), sum(case when p.completed = true then 1L else 0L end)
            from LessonProgress p
            where p.enrollment.course.id = :courseId
              and p.enrollment.isActive = true
            group by p.lesson.id
            """)
    List<Object[]> countLessonProgress(@Param("courseId") Long courseId);

    // ---- 2. Trend ----

    @Query("""
            select e.createdAt from CourseEnrollment e
            where e.course.id = :courseId and e.isActive = true
              and e.createdAt >= :from and e.createdAt < :to
            """)
    List<LocalDateTime> findEnrollmentTimes(@Param("courseId") Long courseId,
                                            @Param("from") LocalDateTime from,
                                            @Param("to") LocalDateTime to);

    @Query("""
            select p.completedAt from LessonProgress p
            where p.enrollment.course.id = :courseId
              and p.completed = true and p.completedAt is not null
              and p.completedAt >= :from and p.completedAt < :to
            """)
    List<LocalDateTime> findLessonCompletionTimes(@Param("courseId") Long courseId,
                                                  @Param("from") LocalDateTime from,
                                                  @Param("to") LocalDateTime to);

    @Query("""
            select c.issuedAt from Certificate c
            where c.course.id = :courseId
              and c.issuedAt >= :from and c.issuedAt <= :to
            """)
    List<LocalDate> findCertificateDates(@Param("courseId") Long courseId,
                                         @Param("from") LocalDate from,
                                         @Param("to") LocalDate to);

    // ---- 3. Activity ----

    @Query("""
            select e from CourseEnrollment e
            join fetch e.user
            where e.course.id = :courseId and e.isActive = true
            """)
    List<CourseEnrollment> findActiveEnrollmentsWithUser(@Param("courseId") Long courseId);

    /** [enrollmentId, số bài đã hoàn thành] */
    @Query("""
            select p.enrollment.id, count(p)
            from LessonProgress p
            where p.enrollment.course.id = :courseId and p.completed = true
            group by p.enrollment.id
            """)
    List<Object[]> countCompletedLessonsPerEnrollment(@Param("courseId") Long courseId);

    // ---- 4. Reviews (xếp hạng nhiều course) ----

    /** [courseId, avg rating, số review] */
    @Query("""
            select r.course.id, avg(r.rating), count(r)
            from CourseReview r
            where r.course.id in :courseIds
            group by r.course.id
            """)
    List<Object[]> aggregateRatings(@Param("courseIds") Collection<Long> courseIds);

    // ---- 5. Exams ----

    /** [examId, studentId, finalScore, status, submittedAt] cho mọi lượt làm của các bài thi thuộc course. */
    @Query("""
            select a.exam.id, a.student.id, a.finalScore, a.status, a.submittedAt
            from ExamAttempt a
            where a.exam.course.id = :courseId
            """)
    List<Object[]> findAttemptRowsByCourse(@Param("courseId") Long courseId);

    @Query("select e from Exam e where e.course.id = :courseId and e.isActive = true order by e.id asc")
    List<Exam> findActiveExamsByCourse(@Param("courseId") Long courseId);

    // ---- Course lookup ----

    @Query("select c from Course c where c.id = :courseId")
    Optional<Course> findCourseById(@Param("courseId") Long courseId);
}
