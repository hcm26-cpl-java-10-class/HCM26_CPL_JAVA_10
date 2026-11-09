package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptStatisticsDTO;
import com.example.starter_project_2025.system.exam.dto.ExamResultStatisticsDTO;
import com.example.starter_project_2025.system.exam.domain.ExamIntegrityEventRepository;
import com.example.starter_project_2025.system.exam.domain.ExamScoreAdjustmentRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExamResultStatisticsServiceTest {

    @Mock
    private ExamRepository examRepository;

    @Mock
    private ExamAttemptRepository attemptRepository;

    @Mock
    private ExamResultReadinessService readinessService;

    @Mock
    private ExamIntegrityEventRepository integrityEventRepository;

    @Mock
    private ExamScoreAdjustmentRepository adjustmentRepository;

    @InjectMocks
    private ExamResultStatisticsService statisticsService;

    private ExamAttemptStatisticsService attemptStatisticsService;

    private Exam testExam;

    @BeforeEach
    void setUp() {
        attemptStatisticsService = new ExamAttemptStatisticsService(
                examRepository,
                attemptRepository,
                integrityEventRepository,
                adjustmentRepository,
                readinessService
        );

        testExam = new Exam();
        testExam.setId(100L);
        testExam.setTitle("Java Certification Exam");
        testExam.setMaxScore(BigDecimal.valueOf(10.0));
        testExam.setPassScore(BigDecimal.valueOf(5.0));
    }

    private ExamAttempt buildAttempt(Long id, BigDecimal score, ExamAttemptStatus status, boolean fullyGraded) {
        ExamAttempt attempt = new ExamAttempt();
        attempt.setId(id);
        attempt.setExam(testExam);
        attempt.setFinalScore(score);
        attempt.setMaxScore(BigDecimal.valueOf(10.0));
        attempt.setStatus(status);
        attempt.setSubmittedAt(status == ExamAttemptStatus.SUBMITTED ? Instant.now() : null);

        User student = new User();
        student.setId(id + 1000);
        student.setFirstName("Student");
        student.setLastName(String.valueOf(id));
        student.setEmail("student" + id + "@example.com");
        attempt.setStudent(student);

        lenient().when(readinessService.isFullyGraded(attempt)).thenReturn(fullyGraded);
        return attempt;
    }

    @Test
    @DisplayName("Scenario 1: All attempts pass (100% pass rate, 0% fail rate)")
    void allAttemptsPass() {
        ExamAttempt a1 = buildAttempt(1L, BigDecimal.valueOf(8.0), ExamAttemptStatus.SUBMITTED, true);
        ExamAttempt a2 = buildAttempt(2L, BigDecimal.valueOf(5.0), ExamAttemptStatus.SUBMITTED, true);
        ExamAttempt a3 = buildAttempt(3L, BigDecimal.valueOf(10.0), ExamAttemptStatus.SUBMITTED, true);

        when(examRepository.findById(100L)).thenReturn(Optional.of(testExam));
        when(attemptRepository.findAllByExam_Id(100L)).thenReturn(List.of(a1, a2, a3));

        ExamResultStatisticsDTO stats = statisticsService.getStatistics(100L);

        assertEquals(3, stats.totalAttempts());
        assertEquals(3, stats.fullyGradedAttempts());
        assertEquals(0, stats.pendingGradingAttempts());
        assertEquals(3, stats.passedAttempts());
        assertEquals(0, stats.failedAttempts());
        assertEquals(100.0, stats.passRate());
        assertEquals(0.0, stats.failRate());
        assertEquals(new BigDecimal("5.0"), stats.passScore());
    }

    @Test
    @DisplayName("Scenario 2: All attempts fail (0% pass rate, 100% fail rate)")
    void allAttemptsFail() {
        ExamAttempt a1 = buildAttempt(1L, BigDecimal.valueOf(4.5), ExamAttemptStatus.SUBMITTED, true);
        ExamAttempt a2 = buildAttempt(2L, BigDecimal.valueOf(2.0), ExamAttemptStatus.SUBMITTED, true);

        when(examRepository.findById(100L)).thenReturn(Optional.of(testExam));
        when(attemptRepository.findAllByExam_Id(100L)).thenReturn(List.of(a1, a2));

        ExamResultStatisticsDTO stats = statisticsService.getStatistics(100L);

        assertEquals(2, stats.totalAttempts());
        assertEquals(2, stats.fullyGradedAttempts());
        assertEquals(0, stats.passedAttempts());
        assertEquals(2, stats.failedAttempts());
        assertEquals(0.0, stats.passRate());
        assertEquals(100.0, stats.failRate());
    }

    @Test
    @DisplayName("Scenario 3: Mixed pass and fail attempts")
    void mixedPassAndFailAttempts() {
        ExamAttempt a1 = buildAttempt(1L, BigDecimal.valueOf(7.5), ExamAttemptStatus.SUBMITTED, true); // Pass
        ExamAttempt a2 = buildAttempt(2L, BigDecimal.valueOf(3.0), ExamAttemptStatus.SUBMITTED, true); // Fail
        ExamAttempt a3 = buildAttempt(3L, BigDecimal.valueOf(5.0), ExamAttemptStatus.SUBMITTED, true); // Pass (exact boundary)
        ExamAttempt a4 = buildAttempt(4L, BigDecimal.valueOf(4.99), ExamAttemptStatus.SUBMITTED, true); // Fail

        when(examRepository.findById(100L)).thenReturn(Optional.of(testExam));
        when(attemptRepository.findAllByExam_Id(100L)).thenReturn(List.of(a1, a2, a3, a4));

        ExamResultStatisticsDTO stats = statisticsService.getStatistics(100L);

        assertEquals(4, stats.totalAttempts());
        assertEquals(4, stats.fullyGradedAttempts());
        assertEquals(2, stats.passedAttempts());
        assertEquals(2, stats.failedAttempts());
        assertEquals(50.0, stats.passRate());
        assertEquals(50.0, stats.failRate());
    }

    @Test
    @DisplayName("Scenario 4: 0 attempts / No graded attempts (division by zero safety)")
    void zeroAttemptsSafe() {
        when(examRepository.findById(100L)).thenReturn(Optional.of(testExam));
        when(attemptRepository.findAllByExam_Id(100L)).thenReturn(Collections.emptyList());

        ExamResultStatisticsDTO stats = statisticsService.getStatistics(100L);

        assertEquals(0, stats.totalAttempts());
        assertEquals(0, stats.fullyGradedAttempts());
        assertEquals(0, stats.passedAttempts());
        assertEquals(0, stats.failedAttempts());
        assertEquals(0.0, stats.passRate());
        assertEquals(0.0, stats.failRate());
        assertNull(stats.averageFinalScore());
    }

    @Test
    @DisplayName("Scenario 5: Incomplete / ungraded attempts excluded from pass/fail denominator")
    void incompleteAttemptsExcludedFromDenominator() {
        ExamAttempt graded1 = buildAttempt(1L, BigDecimal.valueOf(8.0), ExamAttemptStatus.SUBMITTED, true); // Pass
        ExamAttempt inProgress = buildAttempt(2L, null, ExamAttemptStatus.IN_PROGRESS, false); // Not graded
        ExamAttempt pendingReview = buildAttempt(3L, BigDecimal.valueOf(4.0), ExamAttemptStatus.PENDING_REVIEW, false); // Pending

        when(examRepository.findById(100L)).thenReturn(Optional.of(testExam));
        when(attemptRepository.findAllByExam_Id(100L)).thenReturn(List.of(graded1, inProgress, pendingReview));

        ExamResultStatisticsDTO stats = statisticsService.getStatistics(100L);

        assertEquals(3, stats.totalAttempts());
        assertEquals(1, stats.fullyGradedAttempts());
        assertEquals(2, stats.pendingGradingAttempts());
        assertEquals(1, stats.passedAttempts());
        assertEquals(0, stats.failedAttempts());
        assertEquals(100.0, stats.passRate());
        assertEquals(0.0, stats.failRate());
    }

    @Test
    @DisplayName("Scenario 6: Fallback to 50% max score when passScore is null")
    void fallbackToHalfMaxScoreWhenPassScoreNull() {
        testExam.setPassScore(null); // No explicit passScore
        testExam.setMaxScore(BigDecimal.valueOf(20.0)); // Threshold should be 10.0

        ExamAttempt a1 = buildAttempt(1L, BigDecimal.valueOf(10.0), ExamAttemptStatus.SUBMITTED, true); // Pass
        ExamAttempt a2 = buildAttempt(2L, BigDecimal.valueOf(9.9), ExamAttemptStatus.SUBMITTED, true);  // Fail

        when(examRepository.findById(100L)).thenReturn(Optional.of(testExam));
        when(attemptRepository.findAllByExam_Id(100L)).thenReturn(List.of(a1, a2));

        ExamResultStatisticsDTO stats = statisticsService.getStatistics(100L);

        assertEquals(1, stats.passedAttempts());
        assertEquals(1, stats.failedAttempts());
        assertEquals(50.0, stats.passRate());
        assertEquals(50.0, stats.failRate());
        assertEquals(new BigDecimal("10.00"), stats.passScore());
    }

    @Test
    @DisplayName("Scenario 7: AttemptStatisticsDTO correctly reflects passed boolean for each row")
    void attemptStatisticsIncludesPassedFlag() {
        ExamAttempt a1 = buildAttempt(1L, BigDecimal.valueOf(7.0), ExamAttemptStatus.SUBMITTED, true);
        ExamAttempt a2 = buildAttempt(2L, BigDecimal.valueOf(3.0), ExamAttemptStatus.SUBMITTED, true);
        ExamAttempt a3 = buildAttempt(3L, null, ExamAttemptStatus.IN_PROGRESS, false);

        when(examRepository.findById(100L)).thenReturn(Optional.of(testExam));
        when(integrityEventRepository.findAllByExamIdOrderByOccurredAtAsc(100L)).thenReturn(Collections.emptyList());
        when(attemptRepository.findAllByExam_Id(100L)).thenReturn(List.of(a1, a2, a3));

        List<ExamAttemptStatisticsDTO> attemptDTOs = attemptStatisticsService.getAttempts(100L);

        assertEquals(3, attemptDTOs.size());
        assertEquals(Boolean.TRUE, attemptDTOs.get(0).passed());
        assertEquals(Boolean.FALSE, attemptDTOs.get(1).passed());
        assertNull(attemptDTOs.get(2).passed());
    }
}
