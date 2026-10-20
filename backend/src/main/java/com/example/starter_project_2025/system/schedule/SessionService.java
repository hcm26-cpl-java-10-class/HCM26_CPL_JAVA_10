package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.schedule.session.SessionFilter;
import com.example.starter_project_2025.system.schedule.session.dto.ConflictCheckResponse;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;

public interface SessionService extends BaseCrudService<Long, SessionDTO, SessionFilter> {
    ConflictCheckResponse checkConflict(SessionDTO request, Long excludeId);
}
