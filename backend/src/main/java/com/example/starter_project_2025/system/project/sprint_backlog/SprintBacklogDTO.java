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

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.UUID;

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
     * Owning project (UFR-PRJ-003-02).
     * <p>
     * Optional on write: the service derives it from the sprint or from the
     * linked milestone when the client does not send it.
     */
    Long projectId;

    /**
     * Milestone linked to the item (UFR-PRJ-003-02).
     * <p>
     * Send the milestone UUID to link the item; send nothing to keep the
     * current link when updating.
     */
    UUID milestoneId;

    /**
     * Set to {@code true} on update to remove the milestone link (sending a
     * {@code null} {@code milestoneId} means "keep the current milestone").
     */
    Boolean clearMilestone;

    /** Milestone title, read-only convenience for the board. */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    String milestoneName;

    /** Milestone deadline (ISO instant), read-only convenience for the board. */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    Instant milestoneDueDate;

    /**
     * TEMPORARY assignee id (project member module not implemented yet).
     */
    Long assigneeProjectMemberId;

    /** Set true on update to explicitly clear the assignee. */
    Boolean clearAssignee;

    /** Resolved assignee display name for workspace/board read responses. */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    String assigneeDisplayName;

    String title;

    String description;

    LocalDateTime startDate;

    LocalDateTime endDate;

    SprintBacklogStatus status;

    /**
     * Work type of the item: {@code STORY} / {@code BUG} / {@code TASK}.
     * Fixed set, defaults to {@code TASK}.
     */
    SprintBacklogWorkType workType;

    /**
     * Priority of the item: {@code LOW} / {@code MEDIUM} / {@code HIGH} /
     * {@code URGENT}. Defaults to {@code MEDIUM}.
     */
    SprintBacklogPriority priority;

    /**
     * Optional effort estimate in hours (must be greater than or equal to 0).
     */
    Double estimatedHours;

    /**
     * Optimistic locking token, read-only for clients.
     */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    Long version;
}
