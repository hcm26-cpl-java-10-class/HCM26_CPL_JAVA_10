package com.example.starter_project_2025.system.project.sprint_backlog;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Getter
@Setter
public class SprintBacklogFilter extends BaseFilter {

    /**
     * Nested path: the CRUD spec builder joins the sprint relation for us.
     */
    @FilterField(entityField = "sprint.id", operator = FilterOperator.EQUAL)
    Long sprintId;

    @FilterField(entityField = "projectId", operator = FilterOperator.EQUAL)
    Long projectId;

    /**
     * Nested path: filters the items linked to one milestone
     * (UFR-PRJ-003-02).
     */
    @FilterField(entityField = "milestone.id", operator = FilterOperator.EQUAL)
    UUID milestoneId;

    @FilterField(entityField = "status", operator = FilterOperator.EQUAL)
    SprintBacklogStatus status;

    @FilterField(entityField = "workType", operator = FilterOperator.EQUAL)
    SprintBacklogWorkType workType;

    @FilterField(entityField = "priority", operator = FilterOperator.EQUAL)
    SprintBacklogPriority priority;

    @FilterField(entityField = "assigneeProjectMemberId", operator = FilterOperator.EQUAL)
    Long assigneeProjectMemberId;

    @FilterField(entityField = "startDate", operator = FilterOperator.GREATER_OR_EQUAL)
    LocalDateTime startFrom;

    @FilterField(entityField = "endDate", operator = FilterOperator.LESS_OR_EQUAL)
    LocalDateTime endTo;
}
