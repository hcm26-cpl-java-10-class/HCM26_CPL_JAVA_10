package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.analytics.CourseAnalyticsDTO.*;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.department.Department;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.progress.LessonProgress;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Test cho {@link CourseAnalyticsService}.
 *
 * <p>Kiểm tra các quy tắc nghiệp vụ quan trọng:
 * <ul>
 *   <li>Khóa học không có học viên / không có lesson -> số liệu 0, không lỗi.</li>
 *   <li>Học viên chưa từng học KHÔNG bị tính nhầm là Active.</li>
 *   <li>Tỉ lệ bỏ học = (inactive + never started) / tổng học viên.</li>
 *   <li>Phân quyền: giảng viên không xem được phòng ban toàn hệ thống.</li>
 * </ul>
 */
@DataJpaTest
@Import(CourseAnalyticsService.class)
class CourseAnalyticsServiceTest {

    @Autowired
    TestEntityManager db;

    @Autowired
    CourseAnalyticsService service;

    User teacher;
    User student;
    User neverStartedStudent;
    Course course;
    Course emptyCourse;
    Lesson lesson;
    Lesson secondLesson;

    @BeforeEach
    void setUp() {
        Role studentRole = db.persist(Role.builder().name("STUDENT").build());
        teacher = db.persist(User.builder().email("teacher-analytics@example.com").passwordHash("hash")
                .firstName("Teacher").build());
        student = db.persist(User.builder().email("one-analytics@example.com").passwordHash("hash")
                .firstName("One").roles(Set.of(studentRole)).build());
        neverStartedStudent = db.persist(User.builder().email("two-analytics@example.com").passwordHash("hash")
                .firstName("Two").roles(Set.of(studentRole)).build());

        course = db.persist(Course.builder().name("Accessible course").instructorUser(teacher).build());
        emptyCourse = db.persist(Course.builder().name("Empty course").instructorUser(teacher).build());

        Section section = db.persist(Section.builder().course(course).title("Section").orderIndex(1).build());
        lesson = db.persist(Lesson.builder().section(section).title("Lesson")
                .contentType(LessonContentType.TEXT).orderIndex(1).build());
        // Bài học thứ 2 để "hoàn thành 1 bài" chưa đủ để tính là hoàn thành khóa học.
        secondLesson = db.persist(Lesson.builder().section(section).title("Lesson 2")
                .contentType(LessonContentType.TEXT).orderIndex(2).build());
        db.flush();
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    // =================================================================
    // P0-1: Active / Inactive / Never started trong Course Ranking
    // =================================================================

    @Test
    void learnerWhoNeverStartedIsNotCountedAsActive() {
        // Học viên đã học 1 bài nhưng truy cập 2 ngày trước -> active.
        CourseEnrollment active = db.persist(CourseEnrollment.builder()
                .course(course).user(student).isActive(true)
                .lastAccessedAt(LocalDateTime.now().minusDays(2)).build());
        // Học viên chưa từng mở bài học nào -> never started, KHÔNG phải active.
        CourseEnrollment never = db.persist(CourseEnrollment.builder()
                .course(course).user(neverStartedStudent).isActive(true)
                .lastAccessedAt(null).build());
        db.persist(LessonProgress.builder().enrollment(active).lesson(lesson).completed(true).build());
        db.flush();

        authenticate(teacher, "ROLE_ADMIN");
        CourseRankingResponse result = service.getCourseRanking();

        CourseRankingItem item = result.allCourses().stream()
                .filter(i -> i.courseId().equals(course.getId()))
                .findFirst()
                .orElseThrow();

        assertEquals(2, item.learnerCount());
        assertEquals(1, item.activeLearners(), "Học viên truy cập 2 ngày trước phải là active");
        assertEquals(0, item.inactiveLearners());
        assertEquals(1, item.neverStartedLearners(), "Học viên chưa từng học phải nằm ở nhóm never started");
    }

    @Test
    void dropOffRateCountsInactiveAndNeverStartedOnly() {
        CourseEnrollment active = db.persist(CourseEnrollment.builder()
                .course(course).user(student).isActive(true)
                .lastAccessedAt(LocalDateTime.now().minusDays(1)).build());
        CourseEnrollment inactive = db.persist(CourseEnrollment.builder()
                .course(course).user(neverStartedStudent).isActive(true)
                .lastAccessedAt(LocalDateTime.now().minusDays(60)).build());
        db.persist(LessonProgress.builder().enrollment(active).lesson(lesson).completed(true).build());
        db.flush();

        authenticate(teacher, "ROLE_ADMIN");
        CourseRankingResponse result = service.getCourseRanking();
        CourseRankingItem item = result.allCourses().stream()
                .filter(i -> i.courseId().equals(course.getId()))
                .findFirst()
                .orElseThrow();

        // 1 active + 1 inactive => drop-off = 1/2 = 50%, không phải 100% (non-completion).
        assertEquals(1, item.activeLearners());
        assertEquals(1, item.inactiveLearners());
        assertEquals(0, item.neverStartedLearners());
        assertEquals(50.0, item.dropOffRate());
        assertEquals(100.0, item.notCompletedRate(),
                "Non-completion vẫn là 100% vì không ai hoàn thành khóa học");
    }

    @Test
    void completedLearnersAreExcludedFromActiveInactiveAndDropOff() {
        CourseEnrollment completed = db.persist(CourseEnrollment.builder()
                .course(course).user(student).isActive(true)
                .lastAccessedAt(LocalDateTime.now().minusDays(90)).build());
        db.persist(LessonProgress.builder().enrollment(completed).lesson(lesson).completed(true).build());
        db.persist(LessonProgress.builder().enrollment(completed).lesson(secondLesson).completed(true).build());
        db.flush();

        authenticate(teacher, "ROLE_ADMIN");
        CourseRankingResponse result = service.getCourseRanking();
        CourseRankingItem item = result.allCourses().stream()
                .filter(i -> i.courseId().equals(course.getId()))
                .findFirst()
                .orElseThrow();

        assertEquals(1, item.completedLearners());
        assertEquals(0, item.activeLearners());
        assertEquals(0, item.inactiveLearners());
        assertEquals(0, item.dropOffRate());
    }

    // =================================================================
    // P0-2: Khóa học không có học viên / không có lesson
    // =================================================================

    @Test
    void courseWithoutLearnersReturnsZeroedStats() {
        authenticate(teacher, "ROLE_ADMIN");
        CourseRankingResponse result = service.getCourseRanking();

        CourseRankingItem item = result.allCourses().stream()
                .filter(i -> i.courseId().equals(emptyCourse.getId()))
                .findFirst()
                .orElseThrow();

        assertEquals(0, item.learnerCount());
        assertEquals(0.0, item.completionRate());
        assertEquals(0.0, item.dropOffRate());
        assertEquals(0, item.activeLearners());
        assertEquals(0, item.neverStartedLearners());
    }

    @Test
    void lessonFunnelOfCourseWithoutLessonsIsEmptyNotNull() {
        authenticate(teacher, "ROLE_ADMIN");
        LessonFunnelResponse result = service.getLessonFunnel(emptyCourse.getId());

        assertNotNull(result.lessons());
        assertTrue(result.lessons().isEmpty());
        assertEquals(0, result.totalLessons());
        assertNull(result.biggestDropOff());
        assertNull(result.lowestCompletion());
    }

    @Test
    void reviewAnalyticsOfCourseWithoutReviewsIsZeroed() {
        authenticate(teacher, "ROLE_ADMIN");
        CourseReviewAnalyticsResponse result = service.getReviewAnalytics(emptyCourse.getId());

        assertEquals(0, result.totalReviews());
        assertEquals(0.0, result.averageRating());
        assertEquals(0.0, result.reviewCoverage());
        assertEquals(5, result.distribution().size());
        assertTrue(result.distribution().stream().allMatch(b -> b.count() == 0));
    }

    @Test
    void examAnalyticsOfCourseWithoutExamsIsEmpty() {
        authenticate(teacher, "ROLE_ADMIN");
        CourseExamAnalyticsResponse result = service.getExamAnalytics(emptyCourse.getId());

        assertEquals(0, result.totalExams());
        assertTrue(result.exams().isEmpty());
        assertNull(result.overallAverageScorePercent());
        assertNull(result.overallPassRate());
    }

    @Test
    void studyTimeOfCourseWithoutLearnersIsEmpty() {
        authenticate(teacher, "ROLE_ADMIN");
        StudyTimeResponse result = service.getStudyTime(emptyCourse.getId());

        assertEquals(0, result.totalLearners());
        assertEquals(0.0, result.totalStudyHours());
        assertTrue(result.learners().isEmpty());
        assertNull(result.topLearner());
    }

    // =================================================================
    // P0-3: Phân quyền Department Analytics
    // =================================================================

    @Test
    void teacherCannotViewDepartmentAnalyticsAcrossAllCourses() {
        authenticate(teacher, "ROLE_TEACHER");

        AccessDeniedException ex = assertThrows(AccessDeniedException.class,
                () -> service.getDepartmentAnalytics(null));
        assertTrue(ex.getMessage().contains("administrators"));
    }

    @Test
    void adminCanViewDepartmentAnalyticsAcrossAllCourses() {
        authenticate(teacher, "ROLE_ADMIN");
        DepartmentAnalyticsResponse result = service.getDepartmentAnalytics(null);

        assertNotNull(result);
        assertEquals("Toàn hệ thống", result.courseName());
        assertEquals(0, result.departmentCount());
        assertEquals(0, result.totalLearners());
    }

    @Test
    void teacherCannotAccessAnotherTeachersCourse() {
        authenticate(teacher, "ROLE_TEACHER");
        Course foreign = db.persist(Course.builder().name("Foreign course").build());
        db.flush();

        assertThrows(AccessDeniedException.class,
                () -> service.getDepartmentAnalytics(foreign.getId()));
    }

    // =================================================================
    // Học viên mới đăng ký KHÔNG bị coi là bỏ học / nguy cơ
    // =================================================================

    @Test
    void newlyEnrolledNeverStartedLearnerIsNotDroppedOffYet() {
        db.persist(CourseEnrollment.builder()
                .course(course).user(neverStartedStudent).isActive(true).lastAccessedAt(null).build());
        db.flush();

        authenticate(teacher, "ROLE_ADMIN");
        CourseRankingItem item = rankingItemOf(course);

        assertEquals(1, item.neverStartedLearners());
        assertEquals(0.0, item.dropOffRate(), "Mới đăng ký hôm nay chưa thể tính là bỏ học");
    }

    @Test
    void oldNeverStartedLearnerCountsAsDroppedOff() {
        CourseEnrollment never = db.persist(CourseEnrollment.builder()
                .course(course).user(neverStartedStudent).isActive(true).lastAccessedAt(null).build());
        db.flush();
        backdateEnrollment(never, 60);

        authenticate(teacher, "ROLE_ADMIN");
        CourseRankingItem item = rankingItemOf(course);

        assertEquals(1, item.neverStartedLearners());
        assertEquals(100.0, item.dropOffRate());
    }

    @Test
    void activityDoesNotFlagNewLearnerButFlagsOldNeverStartedLearnerAsHighRisk() {
        CourseEnrollment fresh = db.persist(CourseEnrollment.builder()
                .course(course).user(student).isActive(true).lastAccessedAt(null).build());
        CourseEnrollment old = db.persist(CourseEnrollment.builder()
                .course(course).user(neverStartedStudent).isActive(true).lastAccessedAt(null).build());
        db.flush();
        backdateEnrollment(old, 60);

        authenticate(teacher, "ROLE_ADMIN");
        ActivityResponse result = service.getActivity(course.getId(), 14, 50);

        assertEquals(2, result.totalLearners());
        assertEquals(2, result.neverStartedLearners());
        assertEquals(1, result.atRiskCount(), "Chỉ học viên đã bỏ trống 60 ngày mới bị gắn cờ");
        assertEquals(1, result.highRiskCount());
        assertEquals(old.getId(), result.atRiskLearners().getFirst().enrollmentId());
        assertTrue(result.atRiskLearners().stream().noneMatch(a -> a.enrollmentId().equals(fresh.getId())));
    }

    // =================================================================
    // Study time: học viên chưa có progress vẫn xuất hiện
    // =================================================================

    @Test
    void studyTimeIncludesLearnersWithoutAnyProgressRow() {
        CourseEnrollment studying = db.persist(CourseEnrollment.builder()
                .course(course).user(student).isActive(true).build());
        db.persist(CourseEnrollment.builder()
                .course(course).user(neverStartedStudent).isActive(true).build());
        db.persist(LessonProgress.builder().enrollment(studying).lesson(lesson)
                .completed(true).studySeconds(7200L).build());
        db.flush();

        authenticate(teacher, "ROLE_ADMIN");
        StudyTimeResponse result = service.getStudyTime(course.getId());

        assertEquals(2, result.totalLearners());
        assertEquals(2.0, result.totalStudyHours());
        assertEquals(1.0, result.averageStudyHoursPerLearner());
        assertEquals(7200L, result.topLearner().studySeconds());
        assertTrue(result.learners().stream().anyMatch(l -> l.studySeconds() == 0L),
                "Học viên chưa học vẫn phải có dòng với 0 giờ");
    }

    // =================================================================
    // Department analytics: tổng distinct + nhóm chưa phân phòng ban
    // =================================================================

    @Test
    void departmentAnalyticsCountsMultiDepartmentLearnerOnceAndHasUnassignedBucket() {
        Department d1 = db.persist(Department.builder().name("Dept One").code("D1").build());
        Department d2 = db.persist(Department.builder().name("Dept Two").code("D2").build());
        User multi = db.persist(User.builder().email("multi-analytics@example.com").passwordHash("hash")
                .firstName("Multi").departments(Set.of(d1, d2)).build());
        User solo = db.persist(User.builder().email("solo-analytics@example.com").passwordHash("hash")
                .firstName("Solo").build());
        db.persist(CourseEnrollment.builder().course(course).user(multi).isActive(true).build());
        db.persist(CourseEnrollment.builder().course(course).user(solo).isActive(true).build());
        db.flush();

        authenticate(teacher, "ROLE_ADMIN");
        DepartmentAnalyticsResponse result = service.getDepartmentAnalytics(course.getId());

        assertEquals(2, result.totalLearners(), "Người thuộc 2 phòng ban chỉ được đếm 1 lần ở tổng");
        assertEquals(3, result.departmentCount());
        DepartmentAnalyticsItem unassigned = result.departments().stream()
                .filter(d -> "UNASSIGNED".equals(d.departmentCode()))
                .findFirst().orElseThrow();
        assertEquals(-1L, unassigned.departmentId());
        assertEquals(1, unassigned.learnerCount());
        assertNotNull(result.bestDepartment());
        assertNotEquals("UNASSIGNED", result.bestDepartment().departmentCode());
        assertNotEquals("UNASSIGNED", result.worstDepartment().departmentCode());
    }

    // =================================================================
    // Lesson funnel
    // =================================================================

    @Test
    void lessonFunnelComputesCompletionRateAndDropOff() {
        CourseEnrollment e1 = db.persist(CourseEnrollment.builder()
                .course(course).user(student).isActive(true).build());
        CourseEnrollment e2 = db.persist(CourseEnrollment.builder()
                .course(course).user(neverStartedStudent).isActive(true).build());
        db.persist(LessonProgress.builder().enrollment(e1).lesson(lesson).completed(true).build());
        db.persist(LessonProgress.builder().enrollment(e1).lesson(secondLesson).completed(true).build());
        db.persist(LessonProgress.builder().enrollment(e2).lesson(lesson).completed(true).build());
        db.flush();

        authenticate(teacher, "ROLE_ADMIN");
        LessonFunnelResponse result = service.getLessonFunnel(course.getId());

        assertEquals(2, result.totalLearners());
        assertEquals(2, result.lessons().size());
        LessonFunnelItem first = result.lessons().get(0);
        LessonFunnelItem second = result.lessons().get(1);
        assertEquals(100.0, first.completionRate());
        assertEquals(0.0, first.dropOffFromPrevious());
        assertEquals(50.0, second.completionRate());
        assertEquals(50.0, second.dropOffFromPrevious());
        assertEquals(secondLesson.getId(), result.biggestDropOff().lessonId());
        assertEquals(secondLesson.getId(), result.lowestCompletion().lessonId());
    }

    // =================================================================
    // Trend
    // =================================================================

    @Test
    void trendCountsEnrollmentsAndLessonCompletionsInTheirBucket() {
        CourseEnrollment e = db.persist(CourseEnrollment.builder()
                .course(course).user(student).isActive(true).build());
        db.persist(LessonProgress.builder().enrollment(e).lesson(lesson)
                .completed(true).completedAt(LocalDateTime.now()).build());
        db.flush();

        authenticate(teacher, "ROLE_ADMIN");
        LocalDate today = LocalDate.now();
        TrendResponse daily = service.getTrend(course.getId(), today, today, Granularity.DAY);

        assertEquals(1, daily.points().size());
        assertEquals(1, daily.points().getFirst().enrollments());
        assertEquals(1, daily.points().getFirst().lessonsCompleted());
        assertEquals(0, daily.points().getFirst().certificatesIssued());

        TrendResponse weekly = service.getTrend(course.getId(), today.minusDays(20), today, Granularity.WEEK);
        assertTrue(weekly.points().stream().allMatch(p -> p.bucketStart().getDayOfWeek() == DayOfWeek.MONDAY));
        assertEquals(1, weekly.totalEnrollments());

        TrendResponse monthly = service.getTrend(course.getId(), today.minusMonths(2), today, Granularity.MONTH);
        assertTrue(monthly.points().stream().allMatch(p -> p.bucketStart().getDayOfMonth() == 1));
        assertEquals(1, monthly.totalLessonsCompleted());
    }

    @Test
    void trendRejectsInvalidOrTooLargeRanges() {
        authenticate(teacher, "ROLE_ADMIN");
        LocalDate today = LocalDate.now();

        assertThrows(BadRequestException.class,
                () -> service.getTrend(course.getId(), today, today.minusDays(1), Granularity.DAY));
        assertThrows(BadRequestException.class,
                () -> service.getTrend(course.getId(), today.minusDays(1000), today, Granularity.DAY));
    }

    // =================================================================
    // Exam analytics
    // =================================================================

    @Test
    void examAnalyticsComputesAverageAndPassRateFromGradedAttemptsOnly() {
        Exam exam = new Exam();
        exam.setTitle("Midterm");
        exam.setCourse(course);
        db.persist(exam);

        persistAttempt(exam, student, "8.00", ExamAttemptStatus.SUBMITTED, true);
        persistAttempt(exam, neverStartedStudent, "3.00", ExamAttemptStatus.SUBMITTED, true);
        // Đang làm dở -> không tính vào điểm.
        persistAttempt(exam, teacher, null, ExamAttemptStatus.IN_PROGRESS, false);
        db.flush();

        authenticate(teacher, "ROLE_ADMIN");
        CourseExamAnalyticsResponse result = service.getExamAnalytics(course.getId());

        assertEquals(1, result.totalExams());
        ExamAnalyticsItem item = result.exams().getFirst();
        assertEquals(3, item.totalAttempts());
        assertEquals(2, item.gradedAttempts());
        assertEquals(3, item.participants());
        assertEquals(5.5, item.averageScore());
        assertEquals(8.0, item.highestScore());
        assertEquals(3.0, item.lowestScore());
        assertEquals(1, item.passedAttempts(), "Ngưỡng đạt mặc định = 50% của điểm tối đa (5/10)");
        assertEquals(50.0, item.passRate());
        assertEquals(1, item.scoreDistribution().get(1).attempts(), "3/10 = 30% -> nhóm 20-40%");
        assertEquals(1, item.scoreDistribution().get(4).attempts(), "8/10 = 80% -> nhóm 80-100%");
        assertEquals(55.0, result.overallAverageScorePercent());
        assertEquals(50.0, result.overallPassRate());
    }

    // =================================================================
    // Helpers
    // =================================================================

    private CourseRankingItem rankingItemOf(Course target) {
        return service.getCourseRanking().allCourses().stream()
                .filter(i -> i.courseId().equals(target.getId()))
                .findFirst()
                .orElseThrow();
    }

    /** createdAt là updatable=false nên phải sửa bằng native query rồi clear cache. */
    private void backdateEnrollment(CourseEnrollment enrollment, int daysAgo) {
        db.getEntityManager()
                .createNativeQuery("update course_enrollments set created_at = ?1 where id = ?2")
                .setParameter(1, LocalDateTime.now().minusDays(daysAgo))
                .setParameter(2, enrollment.getId())
                .executeUpdate();
        db.clear();
    }

    private void persistAttempt(Exam exam, User who, String score, ExamAttemptStatus status, boolean submitted) {
        ExamAttempt attempt = new ExamAttempt();
        attempt.setExam(exam);
        attempt.setStudent(who);
        attempt.setDurationMinutes(30);
        attempt.setTotalPoints(10);
        attempt.setStartedAt(Instant.now());
        attempt.setStatus(status);
        if (score != null) {
            attempt.setFinalScore(new BigDecimal(score));
        }
        if (submitted) {
            attempt.setSubmittedAt(Instant.now());
        }
        db.persist(attempt);
    }

    private void authenticate(User user, String authority) {
        UserPrincipal principal = new UserPrincipal(user, List.of(new SimpleGrantedAuthority(authority)));
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities()));
    }
}
