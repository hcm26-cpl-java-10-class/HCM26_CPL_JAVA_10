package com.example.starter_project_2025.system.analytics.student;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseMyScoresDTO;
import com.example.starter_project_2025.system.demo.course.CourseMyScoresService;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.progress.LessonProgress;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.domain.ExamResultPublication;
import com.example.starter_project_2025.system.exam.domain.ScoreReleasePolicy;
import com.example.starter_project_2025.system.exam.service.ExamResultAccessService;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.mock;

@DataJpaTest
@Import(StudentAnalyticsService.class)
class StudentAnalyticsServiceTest {
    @Autowired TestEntityManager db;
    @Autowired StudentAnalyticsService service;
    @MockBean CourseMyScoresService scores;
    User teacher;
    User student;
    User otherStudent;
    Course course;
    Course otherCourse;
    CourseEnrollment enrollment;
    Exam exam;
    UserPrincipal teacherPrincipal;
    UserPrincipal adminPrincipal;

    @BeforeEach
    void setUp() {
        Role studentRole = db.persist(Role.builder().name("STUDENT").build());
        teacher = db.persist(User.builder().email("teacher-analytics@example.com").passwordHash("hash")
                .firstName("Teacher").build());
        student = db.persist(User.builder().email("one-analytics@example.com").passwordHash("hash")
                .firstName("One").roles(Set.of(studentRole)).build());
        otherStudent = db.persist(User.builder().email("two-analytics@example.com").passwordHash("hash")
                .firstName("Two").roles(Set.of(studentRole)).build());
        course = db.persist(Course.builder().name("Accessible course").instructorUser(teacher).build());
        otherCourse = db.persist(Course.builder().name("Other course").build());
        enrollment = db.persist(CourseEnrollment.builder().course(course).user(student).build());
        db.persist(CourseEnrollment.builder().course(otherCourse).user(otherStudent).build());
        Section section = db.persist(Section.builder().course(course).title("Section").orderIndex(1).build());
        Lesson lesson = db.persist(Lesson.builder().section(section).title("Lesson")
                .contentType(LessonContentType.TEXT).orderIndex(1).build());
        db.persist(LessonProgress.builder().enrollment(enrollment).lesson(lesson).completed(true).build());
        exam = new Exam();
        exam.setTitle("Exam");
        exam.setDurationMinutes(30);
        exam.setCourse(course);
        db.persist(exam);
        StudentLearningActivity first = new StudentLearningActivity();
        first.setEnrollment(enrollment);
        first.setOccurredAt(Instant.parse("2026-11-02T03:00:00Z"));
        db.persist(first);
        StudentLearningActivity second = new StudentLearningActivity();
        second.setEnrollment(enrollment);
        second.setOccurredAt(Instant.parse("2026-11-03T03:00:00Z"));
        db.persist(second);
        db.flush();
        teacherPrincipal = new UserPrincipal(teacher, List.of(new SimpleGrantedAuthority("ROLE_TEACHER")));
        adminPrincipal = new UserPrincipal(teacher, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    @Test
    void teacherScopeWeeklyActivityAndCompletionAreCalculated() {
        when(scores.findCourseScoresForStudents(org.mockito.ArgumentMatchers.anyMap())).thenReturn(java.util.Map.of(student.getId(), List.of(
                new CourseMyScoresDTO(course.getId(), null, course.getName(), null,
                        new BigDecimal("8.50"), "PASSED", List.of()))));
        var result = service.report(teacherPrincipal, LocalDate.parse("2026-11-02"), LocalDate.parse("2026-11-08"),
                StudentAnalyticsService.Interval.WEEK, null);
        assertEquals(1, result.courses().size());
        assertEquals(1, result.activity().size());
        assertEquals("2026-11-02", result.activity().getFirst().period());
        assertEquals(1, result.activity().getFirst().count());
        assertEquals(1, result.topStudents().size());
        assertEquals(new BigDecimal("8.50"), result.topStudents().getFirst().score());
        assertEquals(new BigDecimal("100.00"), result.lowProgress().getFirst().progress());
        assertEquals(1, result.completionRate().completed());
        assertEquals(1, result.completionRate().withoutSubmittedExam());
        assertEquals(new BigDecimal("100.00"), result.completionRate().percentage());
    }

    @Test
    void teacherCannotFilterAnotherTeachersCourse() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.report(teacherPrincipal, LocalDate.now(), LocalDate.now(),
                        StudentAnalyticsService.Interval.DAY, otherCourse.getId()));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    void adminSeesAllStudentsAndEmptyDenominatorIsNotZeroPercent() {
        LocalDate today = LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh"));
        var result = service.report(adminPrincipal, today, today,
                StudentAnalyticsService.Interval.DAY, otherCourse.getId());
        assertEquals(1, result.enrollmentDistribution().get(1).count());
        assertNull(result.completionRate().percentage());
    }

    @Test
    void invalidDatesAreRejected() {
        assertThrows(ResponseStatusException.class, () -> service.report(adminPrincipal,
                LocalDate.parse("2026-11-08"), LocalDate.parse("2026-11-02"),
                StudentAnalyticsService.Interval.DAY, null));
    }

    @Test
    void storedServerLocalTimeIsConvertedToVietnamTime() {
        assertEquals(LocalDateTime.parse("2026-11-02T00:00:00"),
                StudentAnalyticsService.toVietnamTime(LocalDateTime.parse("2026-11-01T17:00:00"), ZoneId.of("UTC")));
    }

    @Test
    void timezoneBoundariesAndStudentDeduplicationAreApplied() {
        StudentLearningActivity previousDay = new StudentLearningActivity();
        previousDay.setEnrollment(enrollment);
        previousDay.setOccurredAt(Instant.parse("2026-11-01T16:59:59Z"));
        db.persist(previousDay);
        StudentLearningActivity localMonday = new StudentLearningActivity();
        localMonday.setEnrollment(enrollment);
        localMonday.setOccurredAt(Instant.parse("2026-11-01T17:00:00Z"));
        db.persist(localMonday);
        db.flush();
        var result = service.report(teacherPrincipal, LocalDate.parse("2026-11-02"), LocalDate.parse("2026-11-02"),
                StudentAnalyticsService.Interval.DAY, null);
        assertEquals(1, result.activity().getFirst().count());
    }

    @Test
    void submittedExamRemovesCompletedEnrollmentFromNumerator() {
        ExamAttempt attempt = new ExamAttempt();
        attempt.setExam(exam);
        attempt.setStudent(student);
        attempt.setStartedAt(Instant.parse("2026-11-02T03:00:00Z"));
        attempt.setSubmittedAt(Instant.parse("2026-11-02T03:30:00Z"));
        attempt.setDurationMinutes(30);
        db.persist(attempt);
        db.flush();
        var result = service.report(teacherPrincipal, LocalDate.parse("2026-11-02"), LocalDate.parse("2026-11-08"),
                StudentAnalyticsService.Interval.WEEK, null);
        assertEquals(1, result.completionRate().completed());
        assertEquals(0, result.completionRate().withoutSubmittedExam());
        assertEquals(new BigDecimal("0.00"), result.completionRate().percentage());
    }

    @Test
    void equalPublishedScoresShareCompetitionRank() {
        db.persist(CourseEnrollment.builder().course(course).user(otherStudent).build());
        db.flush();
        when(scores.findCourseScoresForStudents(org.mockito.ArgumentMatchers.anyMap())).thenReturn(java.util.Map.of(
                student.getId(), List.of(new CourseMyScoresDTO(course.getId(), null, course.getName(), null,
                        new BigDecimal("8.50"), "PASSED", List.of())),
                otherStudent.getId(), List.of(new CourseMyScoresDTO(course.getId(), null, course.getName(), null,
                        new BigDecimal("8.50"), "PASSED", List.of()))));
        var result = service.report(teacherPrincipal, LocalDate.parse("2026-11-02"), LocalDate.parse("2026-11-08"),
                StudentAnalyticsService.Interval.WEEK, null);
        assertEquals(2, result.topStudents().size());
        assertEquals(1, result.topStudents().get(0).rank());
        assertEquals(1, result.topStudents().get(1).rank());
    }

    @Test
    void batchedCourseScoresUseOnlyPublishedExamResults() {
        exam.setCourseWeight(new BigDecimal("100"));
        com.example.starter_project_2025.system.question.domain.Question q=new com.example.starter_project_2025.system.question.domain.Question();
        q.setContent("Assessment question");q.setType(com.example.starter_project_2025.system.question.domain.QuestionType.MULTIPLE_CHOICE);
        q.setDifficulty(com.example.starter_project_2025.system.question.domain.Difficulty.EASY);q.setIsActive(true);
        db.persist(q);exam.getQuestions().add(q);
        ExamAttempt attempt = new ExamAttempt();
        attempt.setExam(exam);
        attempt.setStudent(student);
        attempt.setStartedAt(Instant.parse("2026-11-02T03:00:00Z"));
        attempt.setSubmittedAt(Instant.parse("2026-11-02T03:30:00Z"));
        attempt.setDurationMinutes(30);
        attempt.setFinalScore(new BigDecimal("8.50"));
        attempt.setStatus(com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus.SUBMITTED);
        db.persist(attempt);
        ExamResultPublication publication = new ExamResultPublication();
        publication.setExam(exam);
        publication.setPublished(true);
        publication.setReleasePolicy(ScoreReleasePolicy.MY_SCORES_ONLY);
        db.persist(publication);
        db.flush();
        var enrollments = mock(CourseEnrollmentRepository.class);
        var exams = mock(ExamRepository.class);
        var attempts = mock(ExamAttemptRepository.class);
        var access = mock(ExamResultAccessService.class);
        when(enrollments.findAllByUser_IdOrderByCreatedAtDesc(student.getId())).thenReturn(List.of(enrollment));
        when(attempts.findAllByStudent_IdOrderByStartedAtDesc(student.getId())).thenReturn(List.of(attempt));
        when(exams.findByCourseLink(course.getId(), null, null, false)).thenReturn(List.of(exam));
        when(access.canStudentSeeScoreOnMyScores(exam)).thenReturn(true);
        CourseMyScoresService actual = new CourseMyScoresService(enrollments, exams, attempts, access, db.getEntityManager(),
                org.mockito.Mockito.mock(com.example.starter_project_2025.system.exam.gradebook.GradebookPublishedItemRepository.class));
        var result = actual.findCourseScoresForStudents(java.util.Map.of(student.getId(), List.of(course)));
        assertEquals(new BigDecimal("8.50"), result.get(student.getId()).getFirst().overallScore());
        assertEquals(actual.findMyCourseScores(student.getId()).getFirst(),
                result.get(student.getId()).getFirst());
        publication.setReleasePolicy(ScoreReleasePolicy.HIDDEN);
        db.flush();
        var hidden = actual.findCourseScoresForStudents(java.util.Map.of(student.getId(), List.of(course)));
        assertNull(hidden.get(student.getId()).getFirst().overallScore());
    }
}
