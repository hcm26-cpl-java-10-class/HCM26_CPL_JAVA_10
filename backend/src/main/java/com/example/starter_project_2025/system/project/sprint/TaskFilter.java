package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
public class TaskFilter extends BaseFilter {

    @FilterField(entityField = "projectId", operator = FilterOperator.EQUAL)
    Long projectId;

    @FilterField(entityField = "sprintId", operator = FilterOperator.EQUAL)
    Long sprintId;

    @FilterField(entityField = "milestoneId", operator = FilterOperator.EQUAL)
    Long milestoneId;

    @FilterField(entityField = "assigneeProjectMemberId", operator = FilterOperator.EQUAL)
    Long assigneeProjectMemberId;

    @FilterField(entityField = "status", operator = FilterOperator.EQUAL)
    TaskStatus status;

    @FilterField(entityField = "priority", operator = FilterOperator.EQUAL)
    TaskPriority priority;

    @FilterField(entityField = "createdAt", operator = FilterOperator.GREATER_OR_EQUAL)
    LocalDateTime createdFrom;

    @FilterField(entityField = "createdAt", operator = FilterOperator.LESS_OR_EQUAL)
    LocalDateTime createdTo;
}