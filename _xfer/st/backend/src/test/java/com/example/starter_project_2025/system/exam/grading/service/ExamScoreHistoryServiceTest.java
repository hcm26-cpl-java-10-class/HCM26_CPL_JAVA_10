package com.example.starter_project_2025.system.exam.grading.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.core.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.grading.domain.ExamScoreAdjustment;
import com.example.starter_project_2025.system.exam.grading.domain.ExamScoreAdjustmentRepository;
import com.example.starter_project_2025.system.exam.grading.dto.ScoreAdjustmentHistoryDTO;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ExamScoreHistoryServiceTest {

    private final ExamRepository exams = mock(ExamRepository.class);
    private final ExamScoreAdjustmentRepository adjustments = mock(ExamScoreAdjustmentRepository.class);
    private final ExamAttemptRepository attempts = mock(ExamAttemptRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final ExamScoreHistoryService service = new ExamScoreHistoryService(exams, adjustments, attempts, users);

    @Test
    void unknownExamIsNotFound() {
        when(exams.existsById(9L)).thenReturn(false);
        assertThrows(ResourceNotFoundException.class, () -> service.history(9L));
    }

    @Test
    void noEditsGivesEmptyList() {
        when(exams.existsById(1L)).thenReturn(true);
        when(adjustments.findAllByExamIdOrderByAdjustedAtDesc(1L)).thenReturn(List.of());
        assertTrue(service.history(1L).isEmpty());
    }

    @Test
    void rowsCarryEditorStudentAndScores() {
        when(exams.existsById(1L)).thenReturn(true);
        ExamScoreAdjustment adj = new ExamScoreAdjustment();
        adj.setAttemptId(5L);
        adj.setExamId(1L);
        adj.setOldScore(new BigDecimal("6.0"));
        adj.setNewScore(new BigDecimal("4.0"));
        adj.setReason("Copied answers");
        adj.setAdjustedBy(7L);
        adj.setAdjustedAt(Instant.parse("2026-11-20T10:00:00Z"));
        when(adjustments.findAllByExamIdOrderByAdjustedAtDesc(1L)).thenReturn(List.of(adj));

        User student = new User();
        student.setFirstName("An");
        student.setLastName("Nguyen");
        ExamAttempt attempt = mock(ExamAttempt.class);
        when(attempt.getId()).thenReturn(5L);
        when(attempt.getAttemptNumber()).thenReturn(2);
        when(attempt.getStudent()).thenReturn(student);
        when(attempts.findAllByExam_Id(1L)).thenReturn(List.of(attempt));

        User teacher = mock(User.class);
        when(teacher.getId()).thenReturn(7L);
        when(teacher.getFirstName()).thenReturn("Lan");
        when(teacher.getLastName()).thenReturn("Tran");
        when(users.findAllById(any())).thenReturn(List.of(teacher));

        List<ScoreAdjustmentHistoryDTO> out = service.history(1L);

        assertEquals(1, out.size());
        assertEquals("An Nguyen", out.get(0).studentName());
        assertEquals("Lan Tran", out.get(0).adjustedByName());
        assertEquals(2, out.get(0).attemptNumber());
        assertEquals(new BigDecimal("4.0"), out.get(0).newScore());
        assertEquals("Copied answers", out.get(0).reason());
    }
}
