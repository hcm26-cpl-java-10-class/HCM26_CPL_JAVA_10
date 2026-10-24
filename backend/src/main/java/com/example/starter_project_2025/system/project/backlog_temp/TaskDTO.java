package com.example.starter_project_2025.system.project.backlog_temp;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/**
 * Request/response payload of a backlog item.
 * <p>
 * Deliberately free of bean validation annotations: the business rules of
 * UFR-PRJ-003-02 (title 1..250, description 1..2000, workflow transitions,
 * milestone link) are enforced by {@link TaskServiceImpl} so they answer
 * {@code 422 Unprocessable Entity} / {@code 404 Not Found} with Vietnamese,
 * field-addressable messages instead of the generic {@code 400} produced by
 * {@code @Validated}.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class TaskDTO extends BaseDTO {

    /**
     * Project the backlog item belongs to (mandatory).
     */
    Long projectId;

    Long sprintId;

    /**
     * Milestone of the same project the item contributes to (optional).
     */
    Long milestoneId;

    Long assigneeProjectMemberId;

    String title;

    String description;

    Double estimatedHours;

    TaskPriority priority;

    TaskStatus status;
}
