package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.schedule.ScheduleCandidate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/** Preparation only. Never pass this incomplete draft to the current demo-only Engine. */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StudySessionScheduleCandidateAdapter {
    private final StudySessionAssignmentResolver assignments;

    public record Diagnostic(String code, String field, String message) {}

    /** No valid flag: this is neither conflict validation nor full business eligibility. */
    public record Preparation(StudySessionScheduleIdentity identity, ScheduleCandidate draft,
                              Long programSubjectId, List<Diagnostic> diagnostics) {
        public Preparation { diagnostics = List.copyOf(diagnostics); }
    }

    public Preparation forCreate(StudySession session) { return prepare(session, false); }

    /** Expects the complete effective entity after a future caller merges a partial update. */
    public Preparation forEdit(StudySession session) { return prepare(session, true); }

    private Preparation prepare(StudySession session, boolean edit) {
        var issues = new ArrayList<Diagnostic>();
        if (session == null) {
            issues.add(new Diagnostic("REQUIRED", "session", "Study session data is required"));
            return new Preparation(null, null, null, issues);
        }
        StudySessionScheduleIdentity identity = null;
        if (edit) {
            positive(session.getId(), "id", true, issues);
            if (session.getId() != null && session.getId() > 0)
                identity = new StudySessionScheduleIdentity(StudySessionScheduleIdentity.Source.STUDY_SESSION, session.getId());
        }
        positive(session.getClassId(), "classId", true, issues);
        positive(session.getTeachingAssignmentId(), "teachingAssignmentId", true, issues);
        positive(session.getSubjectId(), "subjectId", true, issues);
        positive(session.getProgramSubjectId(), "programSubjectId", false, issues);
        positive(session.getTrainerId(), "trainerId", false, issues);
        positive(session.getRoomId(), "roomId", false, issues);
        if (session.getSessionDate() == null) issues.add(new Diagnostic("REQUIRED", "sessionDate", "Session date is required"));
        if (session.getStartTime() == null) issues.add(new Diagnostic("REQUIRED", "startTime", "Start time is required"));
        if (session.getEndTime() == null) issues.add(new Diagnostic("REQUIRED", "endTime", "End time is required"));

        StudySessionAssignmentResolver.ResolvedAssignment resolved = null;
        if (issues.isEmpty()) {
            var ctx = new ValidationContext();
            resolved = assignments.resolveImport(session, ctx);
            ctx.getErrors().entrySet().stream().sorted(java.util.Map.Entry.comparingByKey()).forEach(entry ->
                    entry.getValue().forEach(message -> issues.add(new Diagnostic("ASSIGNMENT_INVALID", entry.getKey(), message))));
            if (resolved == null && !ctx.hasErrors())
                issues.add(new Diagnostic("ASSIGNMENT_UNVERIFIED", "teachingAssignmentId", "No verified assignment was returned"));
        }
        Long trainerId = resolved == null ? null : resolved.trainerId();
        Long programSubjectId = resolved == null ? null : resolved.programSubjectId();
        if (trainerId == null) issues.add(new Diagnostic("MISSING_VERIFIED_ID", "trainerId", "A resolver-verified trainer ID is required"));
        if (programSubjectId == null) issues.add(new Diagnostic("MISSING_VERIFIED_ID", "programSubjectId", "A resolver-verified program subject ID is required"));
        if (session.getRoomId() == null && (session.getMeetingUrl() == null || session.getMeetingUrl().isBlank()))
            issues.add(new Diagnostic("VENUE_DATA_MISSING", "roomId", "Provide an explicit room ID or meeting URL; room names are not resolved"));

        // TODO(Thang/Tu): confirm ProgramSubject.id -> topicId on both candidates and references.
        // subjectId is NOT topicId. Leave topicId null until the contract is agreed.
        issues.add(new Diagnostic("TOPIC_MAPPING_PENDING", "topicId", "ProgramSubject to topic mapping is not confirmed"));
        issues.add(new Diagnostic("ACTIVE_POLICY_PENDING", "assignment", "Active eligibility policies remain unconfirmed"));
        issues.add(new Diagnostic("ENGINE_SOURCE_CONTRACT_PENDING", "id", "Engine source identity contract is not confirmed"));
        var draft = new ScheduleCandidate(null, session.getClassId(), null, trainerId,
                session.getTeachingAssignmentId(), session.getRoomId(), null, session.getMeetingUrl(), session.getTitle(),
                session.getSessionDate() == null || session.getStartTime() == null ? null : session.getSessionDate().atTime(session.getStartTime()),
                session.getSessionDate() == null || session.getEndTime() == null ? null : session.getSessionDate().atTime(session.getEndTime()));
        // Numeric draft ID is intentionally unset: only the source-qualified identity above
        // can describe an Edit. The current Engine would interpret a non-null ID as a demo ID.
        return new Preparation(identity, draft, programSubjectId, issues);
    }

    private void positive(Long id, String field, boolean required, List<Diagnostic> issues) {
        if (id == null && required) issues.add(new Diagnostic("REQUIRED", field, "An explicit " + field + " is required"));
        else if (id != null && id <= 0) issues.add(new Diagnostic("INVALID_ID", field, "ID must be positive"));
    }
}
