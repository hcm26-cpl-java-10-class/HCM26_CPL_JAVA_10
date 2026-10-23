package com.example.starter_project_2025.system.project.backlog_temp;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.project.backlog_temp.audit.TaskAuditLogDTO;

import java.util.List;

public interface TaskService
        extends BaseCrudService<Long, TaskDTO, TaskFilter> {

    /**
     * Audit trail of a backlog item: actor, timestamp, before/after state and
     * correlation id (UFR-PRJ-003-02, "thay đổi thông tin đều được ghi log").
     */
    List<TaskAuditLogDTO> getAuditLogs(Long taskId);
}
