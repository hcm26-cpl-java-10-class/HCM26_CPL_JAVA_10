package com.example.starter_project_2025.system.exam.code;

import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.code.CodeJudgeService.GradeResult;
import com.example.starter_project_2025.system.exam.code.CodeJudgeService.TestResult;
import com.example.starter_project_2025.system.question.core.domain.QuestionType;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CodingGradingServiceTest {

    @Mock ExamAttemptRepository attemptRepository;
    @Mock CodeJudgeService judgeService;
    @Mock PlatformTransactionManager transactionManager;
    @Mock EntityManager entityManager;

    CodingGradingService service;

    private static final String SPEC = "{\"tests\":[{\"inputs\":[\"1\"],\"expected\":\"1\",\"visible\":true}]}";

    @BeforeEach
    void setUp() {
        service = new CodingGradingService(attemptRepository, judgeService, transactionManager);
        ReflectionTestUtils.setField(service, "entityManager", entityManager);
    }

    @SuppressWarnings("unchecked")
    private void dueIds(Long... ids) {
        TypedQuery<Long> query = mock(TypedQuery.class);
        when(entityManager.createQuery(anyString(), eq(Long.class))).thenReturn(query);
        when(query.setParameter(anyString(), any())).thenReturn(query);
        when(query.setMaxResults(anyInt())).thenReturn(query);
        when(query.getResultList()).thenReturn(List.of(ids));
    }

    private ExamAttemptAnswer answer(long id, String spec, String code) {
        ExamAttempt attempt = new ExamAttempt();
        attempt.setId(100L);
        attempt.setTotalPoints(10);
        attempt.setMaxScore(BigDecimal.TEN);
        attempt.setStatus(ExamAttemptStatus.PENDING_REVIEW);
        attempt.setObjectiveScore(BigDecimal.ZERO);
        ExamAttemptQuestion q = new ExamAttemptQuestion();
        q.setId(7L);
        q.setType(QuestionType.CODING);
        q.setPoints(10);
        q.setCodeSpec(spec);
        attempt.getQuestions().add(q);
        ExamAttemptAnswer a = new ExamAttemptAnswer();
        a.setId(id);
        a.setAttempt(attempt);
        a.setQuestion(q);
        a.setTextAnswer(code);
        attempt.getAnswers().add(a);
        return a;
    }

    @Test
    void gradeDueReturnsZeroWhenNothingIsDue() {
        dueIds();
        assertEquals(0, service.gradeDue(5));
        verifyNoInteractions(judgeService);
    }

    @Test
    void gradesAnswerAndStoresScoreAndTestStatuses() {
        ExamAttemptAnswer a = answer(1L, SPEC, "code");
        dueIds(1L);
        when(entityManager.find(ExamAttemptAnswer.class, 1L)).thenReturn(a);
        when(attemptRepository.lockById(100L)).thenReturn(Optional.of(a.getAttempt()));
        when(judgeService.grade(any(), eq("code"))).thenReturn(new GradeResult(1, 2, false, null,
                List.of(new TestResult(true, false, "OK", "1", null), new TestResult(false, false, "WRONG_ANSWER", "2", null))));

        assertEquals(1, service.gradeDue(5));

        assertEquals(0, new BigDecimal("5").compareTo(a.getScore()));
        assertEquals("Đạt 1/2 test", a.getFeedback());
        assertEquals("[\"OK\",\"WRONG_ANSWER\"]", a.getCodeResult());
        assertNull(a.getNextGradeAt());
        assertEquals(0, new BigDecimal("5").compareTo(a.getAttempt().getObjectiveScore()));
        assertEquals(0, new BigDecimal("5").compareTo(a.getAttempt().getFinalScore()));
        assertEquals(ExamAttemptStatus.SUBMITTED, a.getAttempt().getStatus());
        verify(attemptRepository).save(a.getAttempt());
    }

    @Test
    void infraErrorSchedulesRetryWithoutScoring() {
        ExamAttemptAnswer a = answer(1L, SPEC, "code");
        dueIds(1L);
        when(entityManager.find(ExamAttemptAnswer.class, 1L)).thenReturn(a);
        when(attemptRepository.lockById(100L)).thenReturn(Optional.of(a.getAttempt()));
        when(judgeService.grade(any(), any())).thenReturn(new GradeResult(0, 1, true, null, List.of()));

        Instant before = Instant.now();
        service.gradeDue(5);

        assertNull(a.getScore());
        assertEquals(1, a.getGradeAttempts());
        assertTrue(a.getNextGradeAt().isAfter(before));
        assertTrue(a.getFeedback().contains("1/" + CodingGradingService.MAX_AUTO_ATTEMPTS));
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void infraErrorOnLastTryStopsRetryingAndAsksTeacher() {
        ExamAttemptAnswer a = answer(1L, SPEC, "code");
        a.setGradeAttempts(CodingGradingService.MAX_AUTO_ATTEMPTS - 1);
        dueIds(1L);
        when(entityManager.find(ExamAttemptAnswer.class, 1L)).thenReturn(a);
        when(attemptRepository.lockById(100L)).thenReturn(Optional.of(a.getAttempt()));
        when(judgeService.grade(any(), any())).thenReturn(new GradeResult(0, 1, true, null, List.of()));

        service.gradeDue(5);

        assertEquals(CodingGradingService.MAX_AUTO_ATTEMPTS, a.getGradeAttempts());
        assertNull(a.getNextGradeAt());
        assertTrue(a.getFeedback().contains("giáo viên"));
    }

    @Test
    void questionWithoutTestsIsMarkedExhaustedAndNeverSentToJudge() {
        ExamAttemptAnswer a = answer(1L, "{\"tests\":[]}", "code");
        dueIds(1L);
        when(entityManager.find(ExamAttemptAnswer.class, 1L)).thenReturn(a);

        assertEquals(0, service.gradeDue(5));

        assertEquals(CodingGradingService.MAX_AUTO_ATTEMPTS, a.getGradeAttempts());
        verifyNoInteractions(judgeService);
    }

    @Test
    void alreadyGradedAnswerIsSkipped() {
        ExamAttemptAnswer a = answer(1L, SPEC, "code");
        a.setScore(BigDecimal.ONE);
        dueIds(1L);
        when(entityManager.find(ExamAttemptAnswer.class, 1L)).thenReturn(a);

        assertEquals(0, service.gradeDue(5));
        verifyNoInteractions(judgeService);
    }

    @Test
    void manualGradeDuringJudgingDiscardsAutoResult() {
        ExamAttemptAnswer a = answer(1L, SPEC, "code");
        a.getAttempt().setFirstScore(new BigDecimal("9")); // giao vien da sua diem
        dueIds(1L);
        when(entityManager.find(ExamAttemptAnswer.class, 1L)).thenReturn(a);
        when(attemptRepository.lockById(100L)).thenReturn(Optional.of(a.getAttempt()));
        when(judgeService.grade(any(), any())).thenReturn(new GradeResult(1, 1, false, null,
                List.of(new TestResult(true, false, "OK", "1", null))));

        service.gradeDue(5);

        assertNull(a.getScore());
        verify(attemptRepository, never()).save(any());
    }

    @Test
    void judgeFailureOnOneAnswerDoesNotStopTheBatch() {
        ExamAttemptAnswer bad = answer(1L, SPEC, "boom");
        ExamAttemptAnswer ok = answer(2L, SPEC, "fine");
        ok.getAttempt().setId(101L);
        dueIds(1L, 2L);
        when(entityManager.find(ExamAttemptAnswer.class, 1L)).thenReturn(bad);
        when(entityManager.find(ExamAttemptAnswer.class, 2L)).thenReturn(ok);
        when(attemptRepository.lockById(101L)).thenReturn(Optional.of(ok.getAttempt()));
        when(judgeService.grade(any(), eq("boom"))).thenThrow(new IllegalStateException("judge down"));
        when(judgeService.grade(any(), eq("fine"))).thenReturn(new GradeResult(1, 1, false, null,
                List.of(new TestResult(true, false, "OK", "1", null))));

        assertEquals(1, service.gradeDue(5));
        assertNotNull(ok.getScore());
    }
}
