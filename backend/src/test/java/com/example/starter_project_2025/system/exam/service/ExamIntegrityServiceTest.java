package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamIntegrityEvent;
import com.example.starter_project_2025.system.exam.domain.ExamIntegrityEventRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.domain.IntegrityEventType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExamIntegrityServiceTest {

    @Mock
    private ExamAttemptRepository attemptRepository;

    @Mock
    private ExamRepository examRepository;

    @Mock
    private ExamIntegrityEventRepository eventRepository;

    @InjectMocks
    private ExamIntegrityService service;

    private ExamAttempt attempt;

    @BeforeEach
    void setUp() {
        Exam exam = new Exam();
        exam.setId(20L);
        exam.setAntiCheatEnabled(true);

        attempt = new ExamAttempt();
        attempt.setId(30L);
        attempt.setExam(exam);
    }

    @Test
    void summarizeFlagsAttemptWithAnyViolation() {
        when(attemptRepository.findById(30L)).thenReturn(Optional.of(attempt));
        when(eventRepository.findAllByAttemptIdOrderByOccurredAtAsc(30L)).thenReturn(List.of(
                event(IntegrityEventType.TAB_HIDDEN, 5),
                event(IntegrityEventType.COPY, 2)));

        var summary = service.summarize(30L);

        assertTrue(summary.isFlagged());
        assertEquals(2, summary.getTotalViolations());
        assertEquals(1, summary.getTabSwitchCount());
        assertEquals(1, summary.getCopyPasteCount());
        assertEquals(7, summary.getTotalAwaySeconds());
        assertTrue(summary.isAntiCheatEnabled());
    }

    @Test
    void summarizeReportsNoViolationForCleanAttempt() {
        when(attemptRepository.findById(30L)).thenReturn(Optional.of(attempt));
        when(eventRepository.findAllByAttemptIdOrderByOccurredAtAsc(30L)).thenReturn(List.of());

        var summary = service.summarize(30L);

        assertFalse(summary.isFlagged());
        assertEquals(0, summary.getTotalViolations());
    }

    @Test
    void summarizeReportsAntiCheatDisabled() {
        attempt.getExam().setAntiCheatEnabled(false);
        when(attemptRepository.findById(30L)).thenReturn(Optional.of(attempt));
        when(eventRepository.findAllByAttemptIdOrderByOccurredAtAsc(30L)).thenReturn(List.of());

        assertFalse(service.summarize(30L).isAntiCheatEnabled());
    }

    @Test
    void summarizeIsNotFoundForMissingAttempt() {
        when(attemptRepository.findById(404L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.summarize(404L));
    }

    private ExamIntegrityEvent event(IntegrityEventType type, Integer durationSeconds) {
        ExamIntegrityEvent event = new ExamIntegrityEvent();
        event.setAttemptId(30L);
        event.setExamId(20L);
        event.setType(type);
        event.setOccurredAt(Instant.now());
        event.setDurationSeconds(durationSeconds);
        return event;
    }
}
