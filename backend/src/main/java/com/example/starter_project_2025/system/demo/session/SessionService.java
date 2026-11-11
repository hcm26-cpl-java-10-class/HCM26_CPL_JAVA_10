package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import java.util.List;

public interface SessionService extends BaseCrudService<Long, SessionDTO, SessionFilter> {

    SessionDTO cancelSession(Long id, SessionCancelDTO cancelDTO);

    SessionDTO completeSession(Long id);

    SessionDTO rescheduleSession(Long id, SessionRescheduleDTO rescheduleDTO);

    SessionDTO duplicateSession(Long id, SessionDuplicateDTO duplicateDTO);

    List<SessionDTO> createValidatedBatch(List<SessionDTO> requests);

    /**
     * Validates one row of a file import like a newly created session and normalises it in place
     * (status SCHEDULED, trimmed text). Throws when the row must be rejected.
     */
    void validateImportRow(Session session, SessionContextVerifier.Memo memo);
}
