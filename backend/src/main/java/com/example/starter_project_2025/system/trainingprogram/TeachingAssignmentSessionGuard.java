package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.schedule.ScheduleCandidate;
import com.example.starter_project_2025.system.schedule.ScheduleWriteLockRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Local assignment checks supplement shared schedule references under the common write lock. */
@Service
@RequiredArgsConstructor
@Transactional(propagation = Propagation.MANDATORY)
public class TeachingAssignmentSessionGuard {
    private final TeachingAssignmentRepository assignments;
    private final ScheduleWriteLockRepository locks;

    public void lockForWrite() {
        locks.acquire().orElseThrow(() -> new IllegalStateException("Scheduling is temporarily unavailable. Please try again."));
    }

    public void requireCompatible(ScheduleCandidate candidate) {
        // Legacy sessions without an explicit link continue through existing schedule validation.
        if (candidate.teachingAssignmentId() == null) return;
        var assignment = assignments.findById(candidate.teachingAssignmentId()).orElseThrow(() -> invalid("The teaching assignment no longer exists."));
        if (!Boolean.TRUE.equals(assignment.getIsActive())
                || !Objects.equals(assignment.getClassId(), candidate.classId())
                || !Objects.equals(assignment.getTrainerId(), candidate.trainerId())) {
            throw invalid("The session class or trainer does not match the teaching assignment.");
        }
        if (candidate.startTime() != null && candidate.endTime() != null
                && (candidate.startTime().toLocalDate().isBefore(assignment.getEffectiveFrom())
                    || (assignment.getEffectiveTo() != null && candidate.endTime().toLocalDate().isAfter(assignment.getEffectiveTo())))) {
            throw invalid("The session must fall within the current teaching assignment effective period.");
        }
        assignment.setEverUsed(true);
    }

    public void rememberUse(Long assignmentId) {
        if (assignmentId != null) assignments.findById(assignmentId).ifPresent(assignment -> assignment.setEverUsed(true));
    }

    private BusinessValidationException invalid(String message) {
        return new BusinessValidationException(Map.of("teachingAssignmentId", List.of(message)));
    }
}
