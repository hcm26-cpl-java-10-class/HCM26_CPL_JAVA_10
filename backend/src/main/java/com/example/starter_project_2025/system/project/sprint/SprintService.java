package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.project.sprint.audit.SprintAuditLogDTO;

import java.util.List;

public interface SprintService
        extends BaseCrudService<Long, SprintDTO, SprintFilter> {

    /**
     * Audit trail of a sprint, newest first.
     */
    List<SprintAuditLogDTO> getAuditLogs(Long sprintId);
}
