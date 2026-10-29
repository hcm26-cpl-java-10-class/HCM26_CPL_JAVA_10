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

    /**
     * Active milestones that can be linked to a backlog item
     * (UFR-PRJ-003-02).
     *
     * @param teamId when provided, only the milestones of that team are
     *               returned (Backlog tab of a team workspace); {@code null}
     *               keeps the tenant-wide list.
     */
    List<BacklogMilestoneOptionDTO> getMilestoneOptions(Long teamId);

    /**
     * Members of the given team that a backlog item can be assigned to.
     * <p>
     * The Backlog tab of a team workspace passes its team id, so the assignee
     * picker only offers the active members of that team instead of a raw
     * project member id. Callers that are not scoped to a team (the global
     * `/backlogs` page) pass the project of the work item instead and the
     * team that owns that project is used.
     *
     * @param teamId    team that owns the workspace; {@code null} falls back to
     *                  the team of {@code projectId}.
     * @param projectId project of the work item, used when {@code teamId} is
     *                  {@code null}.
     * @return the active members of the resolved team; an empty list when no
     *         team can be resolved.
     */
    List<BacklogAssigneeOptionDTO> getAssigneeOptions(Long teamId, Long projectId);
}
