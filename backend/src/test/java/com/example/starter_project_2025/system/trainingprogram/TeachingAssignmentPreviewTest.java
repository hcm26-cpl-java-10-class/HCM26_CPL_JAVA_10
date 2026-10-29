package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.schedule.*;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TeachingAssignmentPreviewTest {
    @Test void previewDoesNotMarkAssignmentAsUsedButWriteStillDoes() {
        var repository = mock(TeachingAssignmentRepository.class);
        var guard = new TeachingAssignmentSessionGuard(repository, mock(ScheduleWriteLockRepository.class));
        var assignment = new TeachingAssignment();
        assignment.setId(1L); assignment.setClassId(1L); assignment.setTrainerId(1L); assignment.setIsActive(true);
        assignment.setEffectiveFrom(LocalDate.of(2026,1,1)); assignment.setEverUsed(false);
        when(repository.findById(1L)).thenReturn(Optional.of(assignment));
        var candidate = new ScheduleCandidate(null,1L,1L,1L,1L,1L,null,null,"Java",
                LocalDateTime.of(2026,10,28,9,0),LocalDateTime.of(2026,10,28,10,0));
        guard.checkCompatible(candidate);
        assertFalse(Boolean.TRUE.equals(assignment.getEverUsed()));
        guard.requireCompatible(candidate);
        assertTrue(Boolean.TRUE.equals(assignment.getEverUsed()));
    }
}
