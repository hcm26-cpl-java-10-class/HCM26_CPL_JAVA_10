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
        ScoreAppeal done = new ScoreAppeal();
        done.setStatus(ScoreAppealStatus.APPROVED);
        when(appealRepository.findByStudent_IdOrderByCreatedAtDesc(1L)).thenReturn(List.of(pending, done));

        MyScoreInsightsDTO dto = service.getInsights(1L);

        assertEquals(1, dto.awaitingPublicationCount());
        assertEquals(1, dto.pendingAppealCount());
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

        assertEquals(2, dto.accuracyByType().size());
        var byType = dto.accuracyByType().stream()
                .collect(java.util.stream.Collectors.toMap(MyScoreInsightsDTO.TypeAccuracy::type, t -> t));
        assertEquals(0, new BigDecimal("100.0").compareTo(byType.get(QuestionType.MULTIPLE_CHOICE).accuracyPercent()));
        assertEquals(0, BigDecimal.ZERO.compareTo(byType.get(QuestionType.ESSAY).accuracyPercent()));
    }
}
