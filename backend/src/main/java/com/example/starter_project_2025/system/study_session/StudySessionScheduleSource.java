package com.example.starter_project_2025.system.study_session;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;

/** Local source seam; does not implement an unconfirmed interface in Thang's module. */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StudySessionScheduleSource {
    private final StudySessionRepository sessions;

    /** Raw immutable facts, NOT a claim that the row blocks scheduling or passes eligibility. */
    public record Entry(StudySessionScheduleIdentity identity, Long classId, Long teachingAssignmentId,
                        Long subjectId, Long programSubjectId, Long trainerId, Long roomId,
                        String meetingUrl, String title, LocalDateTime startTime, LocalDateTime endTime,
                        SessionStatus status, Boolean isActive) {}

    public List<Entry> findPotentialEntries(LocalDateTime from, LocalDateTime until) {
        return findPotentialEntries(from, until, null);
    }

    /** Exclusion must be a trusted server-side key. A demo key never excludes a StudySession. */
    public List<Entry> findPotentialEntries(LocalDateTime from, LocalDateTime until,
                                             StudySessionScheduleIdentity excluded) {
        if (from == null || until == null || !until.isAfter(from))
            throw new IllegalArgumentException("Provide a non-empty schedule time window");
        // Broad inclusive date bounds deliberately retain adjacent/non-overlapping rows.
        // The Engine, once integrated, remains responsible for exact half-open overlap.
        return sessions.findPotentialScheduleEntries(from.toLocalDate(), until.toLocalDate()).stream()
                .map(this::snapshot).filter(entry -> !Objects.equals(entry.identity(), excluded)).toList();
    }

    private Entry snapshot(StudySession session) {
        return new Entry(new StudySessionScheduleIdentity(StudySessionScheduleIdentity.Source.STUDY_SESSION, session.getId()),
                session.getClassId(), session.getTeachingAssignmentId(), session.getSubjectId(),
                session.getProgramSubjectId(), session.getTrainerId(), session.getRoomId(),
                session.getMeetingUrl(), session.getTitle(),
                session.getSessionDate() == null || session.getStartTime() == null ? null : session.getSessionDate().atTime(session.getStartTime()),
                session.getSessionDate() == null || session.getEndTime() == null ? null : session.getSessionDate().atTime(session.getEndTime()),
                session.getStatus(), session.getIsActive());
    }
}
