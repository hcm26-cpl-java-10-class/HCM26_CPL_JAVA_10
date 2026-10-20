package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.schedule.session.dto.ConflictCheckResponse;
import com.example.starter_project_2025.system.schedule.session.dto.SessionCancelRequest;

public interface SessionService extends BaseCrudService<Long, SessionDTO, SessionFilter> {
    ConflictCheckResponse checkConflict(SessionDTO request, Long excludeId);

    SessionDTO cancel(Long id, SessionCancelRequest request, Long expectedVersion);
    SessionDTO changeStatus(Long id, SessionStatus status);
}
