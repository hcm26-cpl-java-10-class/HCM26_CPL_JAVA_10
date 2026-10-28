package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.system.schedule.*;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentSessionGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Import-specific gate. Existing CRUD, generation and the owners' APIs remain unchanged. */
@Service
@RequiredArgsConstructor
public class SessionImportCoordinator {
    private final SessionImportAssignmentPolicy assignments;
    private final SessionService sessions;
    private final TeachingAssignmentSessionGuard writeGuard;
    private final ScheduleRules rules;

    public ScheduleValidationResult previewValidatedBatch(List<SessionDTO> requests) {
        var issues = new ArrayList<>(assignments.validateAndResolve(requests));
        if (issues.stream().anyMatch(issue -> issue.candidateIndex() < 0))
            return new ScheduleValidationResult(false, rules.getTimezone(), List.copyOf(issues));
        var invalid = new HashSet<Integer>();
        issues.forEach(issue -> invalid.add(issue.candidateIndex()));
        var positions = new ArrayList<Integer>();
        var eligible = new ArrayList<SessionDTO>();
        for (int index = 0; index < requests.size(); index++) {
            if (!invalid.contains(index)) { positions.add(index); eligible.add(requests.get(index)); }
        }
        if (!eligible.isEmpty()) {
            ScheduleValidationResult schedule;
            try {
                schedule = sessions.previewValidatedBatch(eligible);
            } catch (ExternalApiException error) {
                issues.add(new ScheduleIssue("IMPORT_SCHEDULE_SOURCE_UNAVAILABLE", "topicId",
                        "Topic ID (column B): the authoritative scheduling reference source could not be verified. Supply the existing Topic/assignment/resource contract before importing; Subject ID and ProgramSubject ID cannot replace Topic ID.",
                        -1, null, null, null, null, null));
                return new ScheduleValidationResult(false, rules.getTimezone(), List.copyOf(issues));
            }
            for (var issue : schedule.issues()) {
                issues.add(new ScheduleIssue(issue.code(), issue.field(), issue.message(),
                        issue.candidateIndex() < 0 ? -1 : positions.get(issue.candidateIndex()),
                        issue.relatedCandidateIndex() == null ? null : positions.get(issue.relatedCandidateIndex()),
                        issue.relatedSessionId(), issue.relatedTitle(), issue.relatedStart(), issue.relatedEnd(), issue.relatedSource()));
            }
        }
        return new ScheduleValidationResult(issues.isEmpty(), rules.getTimezone(), List.copyOf(issues));
    }

    @Transactional
    public List<SessionDTO> createValidatedBatch(List<SessionDTO> requests) {
        writeGuard.lockForWrite();
        var issues = assignments.validateAndResolve(requests);
        if (!issues.isEmpty()) throw new ScheduleValidationException(new ScheduleValidationResult(false, rules.getTimezone(), issues));
        // Existing atomic writer repeats Topic/reference/resource/conflict checks under the same lock.
        return sessions.createValidatedBatch(requests);
    }
}