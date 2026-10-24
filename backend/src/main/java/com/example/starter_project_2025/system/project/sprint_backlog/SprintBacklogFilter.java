package com.example.starter_project_2025.system.project.sprint_backlog;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class SprintBacklogFilter extends BaseFilter {

    /**
     * Nested path: the CRUD spec builder joins the sprint relation for us.
     */
    @FilterField(entityField = "sprint.id", operator = FilterOperator.EQUAL)
    Long sprintId;

    @FilterField(entityField = "status", operator = FilterOperator.EQUAL)
    SprintBacklogStatus status;

    @FilterField(entityField = "priority", operator = FilterOperator.EQUAL)
    SprintBacklogPriority priority;

    @FilterField(entityField = "assigneeProjectMemberId", operator = FilterOperator.EQUAL)
    Long assigneeProjectMemberId;

    @FilterField(entityField = "startDate", operator = FilterOperator.GREATER_OR_EQUAL)
    LocalDateTime startFrom;

    @FilterField(entityField = "endDate", operator = FilterOperator.LESS_OR_EQUAL)
    LocalDateTime endTo;
}
