package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.schedule.dto.ConflictCheckResponse;

public interface SessionService extends BaseCrudService<Long, SessionDTO, SessionFilter> {
    ConflictCheckResponse checkConflict(SessionDTO request, Long excludeId);
}
