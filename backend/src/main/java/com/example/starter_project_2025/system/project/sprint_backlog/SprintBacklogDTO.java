package com.example.starter_project_2025.system.project.sprint_backlog;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SprintBacklogDTO extends BaseDTO {

    /**
     * Owning sprint. Write it to create / move the item to another sprint.
     * <p>
     * Optional: without it the item stays in the product backlog (no sprint
     * assigned) until it is pulled into a sprint.
     */
    Long sprintId;

    /**
     * Read-only convenience value so the UI can display the sprint without an
     * extra request.
     */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    String sprintName;

    /**
     * TEMPORARY assignee id (project member module not implemented yet).
     */
    Long assigneeProjectMemberId;

    String title;

    String description;

    LocalDateTime startDate;

    LocalDateTime endDate;

    SprintBacklogStatus status;

    /**
     * Optimistic locking token, read-only for clients.
     */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    Long version;
}
