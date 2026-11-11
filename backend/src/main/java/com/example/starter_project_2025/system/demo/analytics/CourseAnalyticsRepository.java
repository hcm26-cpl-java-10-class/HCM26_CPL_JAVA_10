package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course_review.CourseReview;
import com.example.starter_project_2025.system.demo.certificate.Certificate;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.lessonreport.LessonReport;
import com.example.starter_project_2025.system.demo.progress.LessonProgress;
import com.example.starter_project_2025.system.demo.qna.LessonAnswer;
import com.example.starter_project_2025.system.demo.qna.LessonQuestion;
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

    /** [courseId, số sao, số review] — dùng cho so sánh phân bố sao giữa các khóa học. */
    @Query("""
            select r.course.id, r.rating, count(r)
            from CourseReview r
            where r.course.id = :courseId
            group by r.course.id, r.rating
            """)
    List<Object[]> aggregateRatingDistribution(@Param("courseId") Long courseId);

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

    // =================================================================
    // 6. Department analytics
    // =================================================================

    /**
     * [departmentId, departmentCode, departmentName, enrollmentId, courseId,
     *  số bài đã hoàn thành, lastAccessedAt, userId, createdAt]
     * theo phòng ban của học viên (bảng user_departments).
     */
    @Query("""
            select d.id, d.code, d.name, e.id, e.course.id, count(p), e.lastAccessedAt, e.user.id, e.createdAt
            from CourseEnrollment e
              join e.user u
              left join u.departments d
              left join LessonProgress p on p.enrollment = e and p.completed = true
            where e.isActive = true
            group by d.id, d.code, d.name, e.id, e.course.id, e.lastAccessedAt, e.user.id, e.createdAt
            """)
    List<Object[]> findDepartmentEnrollmentsWithProgress();

    /** Như trên nhưng giới hạn theo một khóa học. */
    @Query("""
            select d.id, d.code, d.name, e.id, e.course.id, count(p), e.lastAccessedAt, e.user.id, e.createdAt
            from CourseEnrollment e
              join e.user u
              left join u.departments d
              left join LessonProgress p on p.enrollment = e and p.completed = true
            where e.isActive = true and e.course.id = :courseId
            group by d.id, d.code, d.name, e.id, e.course.id, e.lastAccessedAt, e.user.id, e.createdAt
            """)
    List<Object[]> findDepartmentEnrollmentsWithProgressByCourse(@Param("courseId") Long courseId);

    /** Số bài học active của một khóa học (để biết mốc hoàn thành 100%). */
    @Query("""
            select count(l) from Lesson l
            join l.section s
            where s.course.id = :courseId and l.isActive = true and s.isActive = true
            """)
    long countActiveLessons(@Param("courseId") Long courseId);

    /**
     * [departmentId, điểm thi trung bình (% điểm tối đa), số lượt đã chấm]
     * chỉ tính các lượt thi đã chấm (SUBMITTED / EXPIRED).
     */
    @Query("""
            select d.id, avg(a.finalScore * 100.0 / a.maxScore), count(a)
            from ExamAttempt a
              join a.student u
              left join u.departments d
            where a.finalScore is not null
              and a.maxScore is not null and a.maxScore > 0
              and a.status in (com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus.SUBMITTED,
                               com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus.EXPIRED)
              and (:courseId is null or a.exam.course.id = :courseId)
            group by d.id
            """)
    List<Object[]> aggregateExamScoresByDepartment(@Param("courseId") Long courseId);

    // =================================================================
    // 7. Course ranking
    // =================================================================

    /**
     * [courseId, số học viên đang học, số học viên đã hoàn thành khóa học]
     * (đã hoàn thành = số bài đã hoàn thành >= tổng số bài của khóa).
     */
    @Query("""
            select e.course.id, e.id, count(p)
            from CourseEnrollment e
              left join LessonProgress p on p.enrollment = e and p.completed = true
            where e.isActive = true
            group by e.course.id, e.id
            """)
    List<Object[]> findEnrollmentsWithCompletedLessons();

    /**
     * [courseId, enrollmentId, lastAccessedAt, createdAt, số bài đã hoàn thành]
     * để phân loại active / inactive / never started.
     *
     * <p>Số bài đã hoàn thành dùng để phân biệt "chưa từng học" (0 bài) với
     * "đã học nhưng bỏ dở" (> 0 bài).
     */
    @Query("""
            select e.course.id, e.id, e.lastAccessedAt, e.createdAt,
                   (select count(p) from LessonProgress p
                     where p.enrollment = e and p.completed = true)
            from CourseEnrollment e
            where e.isActive = true
            """)
    List<Object[]> findEnrollmentActivityDetail();

    /**
     * [enrollmentId, tổng studySeconds, số bài đã hoàn thành] cho các enrollment
     * thuộc một khóa học (dùng để tính điểm rủi ro).
     */
    @Query("""
            select p.enrollment.id, sum(coalesce(p.studySeconds, 0)),
                   sum(case when p.completed = true then 1L else 0L end)
            from LessonProgress p
            where p.enrollment.course.id = :courseId and p.enrollment.isActive = true
            group by p.enrollment.id
            """)
    List<Object[]> aggregateStudyAndProgressByEnrollment(@Param("courseId") Long courseId);

    /** Như trên nhưng cho toàn bộ enrollment đang hoạt động (courseId null = toàn hệ thống). */
    @Query("""
            select p.enrollment.id, sum(coalesce(p.studySeconds, 0)),
                   sum(case when p.completed = true then 1L else 0L end)
            from LessonProgress p
            where p.enrollment.isActive = true
              and (:courseId is null or p.enrollment.course.id = :courseId)
            group by p.enrollment.id
            """)
    List<Object[]> aggregateStudyAndProgressAllEnrollments(@Param("courseId") Long courseId);

    /**
     * [userId, điểm thi trung bình (% điểm tối đa)] cho các học viên của một khóa học.
     * Chỉ tính các lượt thi đã chấm (SUBMITTED / EXPIRED).
     */
    @Query("""
            select a.student.id, avg(a.finalScore * 100.0 / a.maxScore)
            from ExamAttempt a
            where a.finalScore is not null
              and a.maxScore is not null and a.maxScore > 0
              and a.status in (com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus.SUBMITTED,
                               com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus.EXPIRED)
              and (:courseId is null or a.exam.course.id = :courseId)
            group by a.student.id
            """)
    List<Object[]> aggregateExamScoresByStudent(@Param("courseId") Long courseId);

    /** Tổng thời lượng (giây) của các bài học active trong một khóa học. */
    @Query("""
            select sum(coalesce(l.duration, 0)) from Lesson l
            join l.section s
            where s.course.id = :courseId and l.isActive = true and s.isActive = true
            """)
    Long sumActiveLessonDurations(@Param("courseId") Long courseId);

    /** Toàn bộ enrollment đang hoạt động kèm user (dùng cho xếp hạng khóa học). */
    @Query("""
            select e from CourseEnrollment e
            join fetch e.user
            where e.isActive = true
            """)
    List<CourseEnrollment> findAllActiveEnrollmentsWithUser();

    /**
     * Enrollment của một phạm vi khóa học (courseId null = toàn hệ thống) kèm user.
     */
    @Query("""
            select e from CourseEnrollment e
            join fetch e.user
            where e.isActive = true
              and (:courseId is null or e.course.id = :courseId)
            """)
    List<CourseEnrollment> findActiveEnrollmentsWithUserScope(@Param("courseId") Long courseId);

    /**
     * [enrollmentId, số bài đã mở, số bài đã hoàn thành, tổng studySeconds]
     * cho các enrollment trong phạm vi (courseId null = toàn hệ thống).
     */
    @Query("""
            select p.enrollment.id, count(p),
                   sum(case when p.completed = true then 1L else 0L end),
                   coalesce(sum(coalesce(p.studySeconds, 0)), 0)
            from LessonProgress p
            where p.enrollment.isActive = true
              and (:courseId is null or p.enrollment.course.id = :courseId)
            group by p.enrollment.id
            """)
    List<Object[]> aggregateLessonProgressByEnrollment(@Param("courseId") Long courseId);

    /**
     * [enrollmentId, số bài đã hoàn thành] cho toàn bộ enrollment đang hoạt động.
     */
    @Query("""
            select p.enrollment.id,
                   sum(case when p.completed = true then 1L else 0L end)
            from LessonProgress p
            where p.enrollment.isActive = true
            group by p.enrollment.id
            """)
    List<Object[]> aggregateCompletedLessonsAllEnrollments();

    /**
     * [enrollmentId, departmentId, departmentCode, departmentName]
     * Một học viên có thể thuộc nhiều phòng ban nên có thể có nhiều dòng.
     */
    @Query("""
            select e.id, d.id, d.code, d.name
            from CourseEnrollment e
              join e.user u
              join u.departments d
            where e.isActive = true
              and (:courseId is null or e.course.id = :courseId)
            """)
    List<Object[]> findEnrollmentDepartments(@Param("courseId") Long courseId);

    /**
     * [departmentId, enrollmentId, userId] cho các enrollment thuộc phòng ban,
     * dùng để thống kê dự đoán rủi ro theo phòng ban.
     */
    @Query("""
            select d.id, e.id, e.user.id
            from CourseEnrollment e
              join e.user u
              join u.departments d
            where e.isActive = true and e.course.id = :courseId
            """)
    List<Object[]> findEnrollmentDepartmentMap(@Param("courseId") Long courseId);

    // =================================================================
    // 8. Content quality + Q&A
    // =================================================================

    /**
     * [lessonId, tổng số báo cáo, số báo cáo đang mở, số báo cáo đã xử lý]
     * cho các bài học thuộc khóa học.
     */
    @Query("""
            select r.lesson.id, count(r),
                   sum(case when r.status = com.example.starter_project_2025.system.demo.lessonreport.LessonReportStatus.OPEN then 1L else 0L end),
                   sum(case when r.status = com.example.starter_project_2025.system.demo.lessonreport.LessonReportStatus.RESOLVED then 1L else 0L end)
            from LessonReport r
            where r.lesson.section.course.id = :courseId
            group by r.lesson.id
            """)
    List<Object[]> countReportsByLesson(@Param("courseId") Long courseId);

    /** [reason, số báo cáo] theo khóa học. */
    @Query("""
            select r.reason, count(r)
            from LessonReport r
            where r.lesson.section.course.id = :courseId
            group by r.reason
            """)
    List<Object[]> countReportsByReason(@Param("courseId") Long courseId);

    /** [lessonId, reason, số báo cáo] để tìm lý do phổ biến nhất của từng bài học. */
    @Query("""
            select r.lesson.id, r.reason, count(r)
            from LessonReport r
            where r.lesson.section.course.id = :courseId
            group by r.lesson.id, r.reason
            """)
    List<Object[]> countReportsByLessonAndReason(@Param("courseId") Long courseId);

    /**
     * [questionId, thời điểm hỏi, thời điểm trả lời đầu tiên] cho mọi câu hỏi của khóa học.
     * Thời điểm trả lời null nghĩa là câu hỏi chưa được trả lời.
     */
    @Query("""
            select q.id, q.createdAt, min(a.createdAt)
            from LessonQuestion q
              left join LessonAnswer a on a.question = q
            where q.lesson.section.course.id = :courseId
            group by q.id, q.createdAt
            """)
    List<Object[]> findQuestionsWithFirstAnswer(@Param("courseId") Long courseId);

    /** Câu hỏi chưa trả lời của khóa học, mới nhất trước. */
    @Query("""
            select q
            from LessonQuestion q
            where q.lesson.section.course.id = :courseId
              and not exists (select 1 from LessonAnswer a where a.question = q)
            order by q.createdAt desc
            """)
    List<LessonQuestion> findUnansweredQuestions(@Param("courseId") Long courseId);

    // =================================================================
    // 9. Study time (số giờ học)
    // =================================================================

    /**
     * [enrollmentId, userId, fullName, email, tổng studySeconds, số bài đã hoàn thành,
     *  lastAccessedAt] cho từng học viên đang học một khóa học (kể cả người chưa có bản ghi progress).
     *
     * <p>{@code fullName} được ghép từ {@code firstName} + {@code lastName} vì User
     * không có field tên hiển thị trực tiếp.
     */
    @Query("""
            select e.id, e.user.id,
                   trim(concat(coalesce(e.user.firstName, ''), ' ', coalesce(e.user.lastName, ''))),
                   e.user.email,
                   coalesce(sum(coalesce(p.studySeconds, 0L)), 0L),
                   coalesce(sum(case when p.completed = true then 1L else 0L end), 0L),
                   coalesce(max(p.lastAccessedAt), e.lastAccessedAt)
            from CourseEnrollment e
              left join LessonProgress p on p.enrollment = e
            where e.course.id = :courseId and e.isActive = true
            group by e.id, e.user.id, e.user.firstName, e.user.lastName, e.user.email, e.lastAccessedAt
            """)
    List<Object[]> findStudyTimeByLearner(@Param("courseId") Long courseId);

    /**
     * [departmentId, tổng studySeconds] theo phòng ban, giới hạn theo khóa học
     * (courseId null = toàn hệ thống).
     */
    @Query("""
            select d.id, sum(coalesce(p.studySeconds, 0))
            from LessonProgress p
              join p.enrollment e
              join e.user u
              left join u.departments d
            where e.isActive = true
              and (:courseId is null or e.course.id = :courseId)
            group by d.id
            """)
    List<Object[]> aggregateStudySecondsByDepartment(@Param("courseId") Long courseId);
}
