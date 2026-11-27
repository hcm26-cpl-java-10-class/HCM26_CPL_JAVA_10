package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.exam.analytics.service.ExamAttemptStatisticsService;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.attempt.service.ExamAttemptLifecycle;
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.core.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.core.service.ExamConfigValidator;
import com.example.starter_project_2025.system.exam.integrity.domain.ExamAttemptIntegrityReview;
import com.example.starter_project_2025.system.exam.integrity.domain.ExamAttemptIntegrityReviewRepository;
import com.example.starter_project_2025.system.exam.integrity.domain.IntegrityReviewStatus;
import com.example.starter_project_2025.system.exam.integrity.dto.IntegrityReviewRequest;
import com.example.starter_project_2025.system.exam.integrity.service.ExamIntegrityReviewService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExamPhase3UnitTest {

    private final ExamConfigValidator validator = new ExamConfigValidator();

    @Mock
    private ExamAttemptRepository attemptRepository;

    @Mock
    private ExamAttemptIntegrityReviewRepository reviewRepository;

    @InjectMocks
    private ExamIntegrityReviewService integrityReviewService;

    @Test
    void configValidator_rejectsEndTimeBeforeStartTime() {
        ExamDTO dto = new ExamDTO();
        dto.setDurationMinutes(30);
        dto.setStartTime(LocalDateTime.of(2026, 12, 1, 10, 0));
        dto.setEndTime(LocalDateTime.of(2026, 12, 1, 9, 0));
        ValidationContext ctx = new ValidationContext();

        validator.validate(null, dto, 10, ctx);

        assertThrows(BusinessValidationException.class, ctx::throwIfErrors);
    }

    @Test
    void configValidator_rejectsDurationLongerThanOpenWindow() {
        ExamDTO dto = new ExamDTO();
        dto.setDurationMinutes(90);
        dto.setStartTime(LocalDateTime.of(2026, 12, 1, 10, 0));
        dto.setEndTime(LocalDateTime.of(2026, 12, 1, 11, 0));
        ValidationContext ctx = new ValidationContext();

        validator.validate(null, dto, 10, ctx);

        assertThrows(BusinessValidationException.class, ctx::throwIfErrors);
    }

    @Test
    void configValidator_acceptsValidScheduleWindow() {
        ExamDTO dto = new ExamDTO();
        dto.setDurationMinutes(60);
        dto.setStartTime(LocalDateTime.of(2026, 12, 1, 10, 0));
        dto.setEndTime(LocalDateTime.of(2026, 12, 1, 12, 0));
        ValidationContext ctx = new ValidationContext();

        validator.validate(null, dto, 10, ctx);

        assertDoesNotThrow(ctx::throwIfErrors);
    }

    @Test
    void integrityReview_requiresNoteWhenConfirmingViolation() {
        Exam exam = new Exam();
        exam.setId(10L);
        ExamAttempt attempt = new ExamAttempt();
        attempt.setId(50L);
        attempt.setExam(exam);

        when(attemptRepository.findById(50L)).thenReturn(Optional.of(attempt));

        assertThrows(BadRequestException.class, () ->
                integrityReviewService.submitReview(
                        10L,
                        50L,
                        new IntegrityReviewRequest(IntegrityReviewStatus.CONFIRMED_VIOLATION, "   "),
                        1L
                ));
    }

    @Test
    void integrityReview_savesClearedDisposition() {
        Exam exam = new Exam();
        exam.setId(10L);
        ExamAttempt attempt = new ExamAttempt();
        attempt.setId(50L);
        attempt.setExam(exam);

        when(attemptRepository.findById(50L)).thenReturn(Optional.of(attempt));
        when(reviewRepository.findByAttemptId(50L)).thenReturn(Optional.empty());
        when(reviewRepository.save(any(ExamAttemptIntegrityReview.class)))
                .thenAnswer(inv -> inv.getArgument(0));

        ExamAttemptIntegrityReview saved = integrityReviewService.submitReview(
                10L,
                50L,
                new IntegrityReviewRequest(IntegrityReviewStatus.CLEARED, "False positive tab switch"),
                7L
        );

        assertEquals(IntegrityReviewStatus.CLEARED, saved.getReviewStatus());
        assertEquals("False positive tab switch", saved.getReviewNote());
        assertEquals(7L, saved.getReviewedBy());
        assertNotNull(saved.getReviewedAt());
    }

    @Test
    void attemptLifecycle_supportsReturnForRevisionAndResubmit() {
        assertTrue(ExamAttemptLifecycle.canTransition(ExamAttemptStatus.PENDING_REVIEW, ExamAttemptStatus.RETURNED_FOR_REVISION));
        assertTrue(ExamAttemptLifecycle.canTransition(ExamAttemptStatus.SUBMITTED, ExamAttemptStatus.RETURNED_FOR_REVISION));
        assertTrue(ExamAttemptLifecycle.canTransition(ExamAttemptStatus.RETURNED_FOR_REVISION, ExamAttemptStatus.PENDING_REVIEW));
        assertFalse(ExamAttemptLifecycle.isFinished(ExamAttemptStatus.RETURNED_FOR_REVISION));
        assertEquals(ExamAttemptLifecycle.SaveAction.APPLY,
                ExamAttemptLifecycle.decideSave(ExamAttemptStatus.RETURNED_FOR_REVISION, false));
    }

    @Test
    void attemptStatisticsLockReason_allowsOverrideForAnyGradedAttempt() {
        ExamAttempt attempt = new ExamAttempt();
        attempt.setStatus(ExamAttemptStatus.SUBMITTED);
        attempt.setFinalScore(BigDecimal.valueOf(8.5));

        assertNull(ExamAttemptStatisticsService.lockReason(attempt, 0L));
    }
}
