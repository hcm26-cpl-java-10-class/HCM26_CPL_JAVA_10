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

    /**
     * Flattened rows for the Excel/CSV export.
     */
    List<SprintExportRow> getExportRows();

    /**
     * Sprint Planning board: sprint header, ordered Sprint Backlog and the
     * items still available in the product backlog (UFR-PRJ-003-03).
     */
    SprintPlanningDTO getPlanning(Long sprintId);

    /**
     * Assigns / unassigns backlog items and persists their priority order in a
     * single transaction (UFR-PRJ-003-03, AC01 / AC02).
     */
    SprintPlanningDTO saveSprintBacklog(Long sprintId, SprintBacklogPlanDTO request);
}
