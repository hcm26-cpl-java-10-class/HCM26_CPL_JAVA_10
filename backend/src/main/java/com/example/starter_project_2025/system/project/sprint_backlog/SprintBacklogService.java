package com.example.starter_project_2025.system.project.sprint_backlog;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditLogDTO;

import java.util.List;

public interface SprintBacklogService
        extends BaseCrudService<Long, SprintBacklogDTO, SprintBacklogFilter> {

    /**
     * Every backlog item of a sprint, in creation order.
     */
    List<SprintBacklogDTO> getBySprintId(Long sprintId);

    /**
     * Audit trail of a backlog item, newest first.
     */
    List<SprintBacklogAuditLogDTO> getAuditLogs(Long sprintBacklogId);
}
