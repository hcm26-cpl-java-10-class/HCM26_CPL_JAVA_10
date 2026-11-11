package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.MyScoreInsightsDTO;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MyScoreInsightsServiceTest {

    @Mock private ExamAttemptRepository attemptRepository;
    @Mock private ScoreAppealRepository appealRepository;
    @Mock private ExamResultAccessService resultAccessService;
    @Mock private com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository enrollmentRepository;
    @Mock private com.example.starter_project_2025.system.demo.progress.LessonProgressRepository progressRepository;
    @Mock private com.example.starter_project_2025.system.demo.lesson.LessonRepository lessonRepository;
    @Mock private ExamRepository examRepository;
    @InjectMocks private MyScoreInsightsService service;

    private ExamAttempt attempt(Exam exam, long studentId, String score) {
        ExamAttempt a = new ExamAttempt();
        a.setExam(exam);
        a.setStudent(User.builder().id(studentId).build());
        a.setDurationMinutes(30);
        a.setMaxScore(BigDecimal.TEN);
        a.setFinalScore(new BigDecimal(score));
        a.setStartedAt(Instant.parse("2026-01-01T10:00:00Z"));
        a.setSubmittedAt(Instant.parse("2026-01-01T10:12:00Z"));
        return a;
    }

    private Exam exam() {
        Exam e = new Exam();
        e.setId(1L);
        e.setTitle("Quiz 1");
        return e;
    }

    @Test
    void classAverageHiddenBelowThreeParticipants() {
        Exam exam = exam();
        ExamAttempt mine = attempt(exam, 1L, "8.00");
        when(attemptRepository.findAllByStudent_IdOrderByStartedAtDesc(1L)).thenReturn(List.of(mine));
        when(attemptRepository.findAllByExam_Id(1L)).thenReturn(List.of(mine, attempt(exam, 2L, "4.00")));
        when(resultAccessService.isResultPublished(any())).thenReturn(true);
        when(appealRepository.findByStudent_IdOrderByCreatedAtDesc(1L)).thenReturn(List.of());

        MyScoreInsightsDTO dto = service.getInsights(1L);

        assertTrue(dto.classAverages().isEmpty());
        assertEquals(1, dto.attempts().size());
        assertEquals(720L, dto.attempts().get(0).timeSpentSeconds());
    }

    @Test
    void classAverageUsesEachStudentsBestAttempt() {
        Exam exam = exam();
        ExamAttempt mine = attempt(exam, 1L, "8.00");
        ExamAttempt worse = attempt(exam, 1L, "2.00");
        when(attemptRepository.findAllByStudent_IdOrderByStartedAtDesc(1L)).thenReturn(List.of(mine));
        when(attemptRepository.findAllByExam_Id(1L)).thenReturn(List.of(
                mine, worse, attempt(exam, 2L, "6.00"), attempt(exam, 3L, "4.00")));
        when(resultAccessService.isResultPublished(any())).thenReturn(true);
        when(appealRepository.findByStudent_IdOrderByCreatedAtDesc(1L)).thenReturn(List.of());

        MyScoreInsightsDTO dto = service.getInsights(1L);

        assertEquals(1, dto.classAverages().size());
        assertEquals(0, new BigDecimal("60.00").compareTo(dto.classAverages().get(0).averagePercent()));
        assertEquals(3, dto.classAverages().get(0).participants());
    }

    @Test
    void unpublishedExamsAreCountedAndPendingAppealsCounted() {
        Exam exam = exam();
        when(attemptRepository.findAllByStudent_IdOrderByStartedAtDesc(1L))
                .thenReturn(List.of(attempt(exam, 1L, "8.00")));
        when(resultAccessService.isResultPublished(any())).thenReturn(false);
        ScoreAppeal pending = new ScoreAppeal();
        pending.setStatus(ScoreAppealStatus.PENDING);
        pending.setExam(exam);
        ScoreAppeal done = new ScoreAppeal();
        done.setStatus(ScoreAppealStatus.APPROVED);
        done.setExam(exam);
        when(appealRepository.findByStudent_IdOrderByCreatedAtDesc(1L)).thenReturn(List.of(pending, done));

        MyScoreInsightsDTO dto = service.getInsights(1L);

        assertEquals(List.of(1L), dto.awaitingExamIds());
        assertEquals(List.of(1L), dto.pendingAppealExamIds());
        assertTrue(dto.attempts().isEmpty());
    }

    @Test
    void accuracyByTypeSumsEarnedOverPossible() {
        Exam exam = exam();
        ExamAttempt a = attempt(exam, 1L, "5.00");
        ExamAttemptQuestion mc = new ExamAttemptQuestion();
        mc.setId(10L); mc.setType(QuestionType.MULTIPLE_CHOICE); mc.setPoints(1);
        ExamAttemptQuestion essay = new ExamAttemptQuestion();
        essay.setId(11L); essay.setType(QuestionType.ESSAY); essay.setPoints(1);
        a.setQuestions(new ArrayList<>(List.of(mc, essay)));
        ExamAttemptAnswer ans = new ExamAttemptAnswer();
        ans.setQuestion(mc);
        ans.setScore(new BigDecimal("5.00"));
        a.getAnswers().add(ans);
        when(attemptRepository.findAllByStudent_IdOrderByStartedAtDesc(1L)).thenReturn(List.of(a));
        when(attemptRepository.findAllByExam_Id(1L)).thenReturn(List.of(a));
        when(resultAccessService.isResultPublished(any())).thenReturn(true);
        when(appealRepository.findByStudent_IdOrderByCreatedAtDesc(1L)).thenReturn(List.of());

        MyScoreInsightsDTO dto = service.getInsights(1L);

        assertEquals(2, dto.accuracyByExamType().size());
        var byType = dto.accuracyByExamType().stream()
                .collect(java.util.stream.Collectors.toMap(MyScoreInsightsDTO.TypeAccuracy::type, t -> t));
        assertEquals(1L, byType.get(QuestionType.MULTIPLE_CHOICE).examId());
        assertEquals(0, new BigDecimal("5.00").compareTo(byType.get(QuestionType.MULTIPLE_CHOICE).earned()));
        assertEquals(0, new BigDecimal("5.00").compareTo(byType.get(QuestionType.MULTIPLE_CHOICE).possible()));
        assertEquals(0, BigDecimal.ZERO.compareTo(byType.get(QuestionType.ESSAY).earned()));
    }

    @Test
    void coursesReportEnrollmentDateProgressAndExams() {
        var course = new com.example.starter_project_2025.system.demo.course.Course();
        course.setId(5L);
        course.setName("Java Fundamentals");
        var enrollment = new com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment();
        enrollment.setId(50L);
        enrollment.setCourse(course);
        enrollment.setCreatedAt(java.time.LocalDateTime.of(2026, 3, 1, 9, 0));
        var done = new com.example.starter_project_2025.system.demo.progress.LessonProgress();
        done.setCompleted(true);
        Exam exam = exam();
        when(attemptRepository.findAllByStudent_IdOrderByStartedAtDesc(1L)).thenReturn(List.of());
        when(appealRepository.findByStudent_IdOrderByCreatedAtDesc(1L)).thenReturn(List.of());
        when(enrollmentRepository.findAllByUser_IdOrderByCreatedAtDesc(1L)).thenReturn(List.of(enrollment));
        when(lessonRepository.findStatsByCourseIds(any()))
                .thenReturn(List.of(new com.example.starter_project_2025.system.demo.lesson.CourseLessonStats(5L, 4L, 0L)));
        when(progressRepository.findAllByEnrollment_Id(50L)).thenReturn(List.of(done));
        when(examRepository.findByCourseLink(5L, null, null, false)).thenReturn(List.of(exam));

        MyScoreInsightsDTO dto = service.getInsights(1L);

        assertEquals(1, dto.courses().size());
        var info = dto.courses().get(0);
        assertEquals("Java Fundamentals", info.courseName());
        assertEquals(java.time.LocalDateTime.of(2026, 3, 1, 9, 0), info.enrolledAt());
        assertEquals(4L, info.lessonsTotal());
        assertEquals(1L, info.lessonsCompleted());
        assertEquals(List.of(1L), info.examIds());
    }
}
