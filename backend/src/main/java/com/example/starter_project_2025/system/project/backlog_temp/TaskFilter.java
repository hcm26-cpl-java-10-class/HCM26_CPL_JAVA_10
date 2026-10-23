package com.example.starter_project_2025.system.project.backlog_temp;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TaskFilter extends BaseFilter {

    /**
     * Free text search on the title, used by the table's text filter.
     */
    @FilterField(entityField = "title", operator = FilterOperator.LIKE)
    String title;

    @FilterField(entityField = "projectId")
    Long projectId;

    @FilterField(entityField = "sprintId")
    Long sprintId;

    @FilterField(entityField = "milestoneId")
    Long milestoneId;

    @FilterField(entityField = "assigneeProjectMemberId")
    Long assigneeProjectMemberId;

    @FilterField(entityField = "priority")
    TaskPriority priority;

    @FilterField(entityField = "status")
    TaskStatus status;

    @FilterField(entityField = "estimatedHours", operator = FilterOperator.GREATER_OR_EQUAL)
    Double minEstimatedHours;

    @FilterField(entityField = "estimatedHours", operator = FilterOperator.LESS_OR_EQUAL)
    Double maxEstimatedHours;
}
