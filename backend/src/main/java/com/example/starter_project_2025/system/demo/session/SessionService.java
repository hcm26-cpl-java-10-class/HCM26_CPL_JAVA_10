package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface SessionService extends BaseCrudService<Long, SessionDTO, SessionFilter> {

    /**
     * Queries active sessions overlapping the half-open calendar interval [from, to)
     * (startTime < to && endTime > from), optionally scoped to verified personal trainer/class IDs.
     */
    Page<SessionDTO> getCalendarSessions(
            LocalDateTime from,
            LocalDateTime to,
            Session.SessionStatus status,
            Long classId,
            Long trainerId,
            Long topicId,
            String location,
            Collection<Long> scopedTrainerIds,
            Collection<Long> scopedClassIds,
            boolean restrictToScope,
            Pageable pageable
    );

    SessionDTO cancelSession(Long id, SessionCancelDTO cancelDTO);

    SessionDTO completeSession(Long id);

    SessionDTO rescheduleSession(Long id, SessionRescheduleDTO rescheduleDTO);

    SessionDTO duplicateSession(Long id, SessionDuplicateDTO duplicateDTO);

    List<SessionDTO> createValidatedBatch(List<SessionDTO> requests);

    void deleteByClassId(Long classId);

    /**
     * Validates one row of a file import like a newly created session and normalises it in place
     * (status SCHEDULED, trimmed text). Throws when the row must be rejected.
     */
    void validateImportRow(Session session, SessionContextVerifier.Memo memo);
}
