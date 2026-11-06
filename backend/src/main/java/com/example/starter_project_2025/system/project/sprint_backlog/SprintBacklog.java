package com.example.starter_project_2025.system.project.sprint_backlog;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.PostImport;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

/**
 * Sprint Backlog item: one task of a sprint.
 * <p>
 * A sprint owns one or many backlog items ({@link Sprint#getSprintBacklogs()}),
 * the owning side of the relation is this class ({@code sprint_id}).
 * <p>
 * The relation is optional: an item without a sprint is a <em>product
 * backlog</em> item that only becomes a sprint backlog item once it is pulled
 * into a sprint.
 * <p>
 * Mapping notes (compared to the team's class diagram):
 * <ul>
 *     <li>{@code sprint_backlog_id} is a {@code Long} because {@link BaseEntity}
 *     (and the whole CRUD base: id filters, DTO ids, frontend types) is Long
 *     based, so the diagram's {@code uuid} type is adapted here - exactly like
 *     {@code Sprint} / {@code Task}.</li>
 *     <li>{@code assignee_project_member_id} is a plain identifier:
 *     TEMPORARY, the project member module is not implemented yet, so no
 *     relation/lookup/validation is done on it (same approach as
 *     {@code Task#assigneeProjectMemberId}).</li>
 *     <li>{@code created_at} / {@code updated_at} come from {@link BaseEntity}.</li>
 * </ul>
 * Business validation (title/description length, date order, existing sprint)
 * lives in {@link SprintBacklogServiceImpl} so every failure surfaces as a
 * business error (422) instead of a generic bean validation error.
 */
@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "sprint_backlog",
        indexes = {
                @Index(name = "idx_sprint_backlog_sprint", columnList = "sprint_id"),
                @Index(name = "idx_sprint_backlog_status", columnList = "status"),
                @Index(name = "idx_sprint_backlog_work_type", columnList = "work_type"),
                @Index(name = "idx_sprint_backlog_assignee", columnList = "assignee_project_member_id"),
                @Index(name = "idx_sprint_backlog_reporter", columnList = "reporter_project_member_id"),
                @Index(name = "idx_sprint_backlog_project", columnList = "project_id"),
                @Index(name = "idx_sprint_backlog_milestone", columnList = "milestone_id")
        }
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@AttributeOverride(name = "id", column = @Column(name = "sprint_backlog_id"))
@ImportEntity("sprint-backlog")
@ResourcePermission("SPRINT_BACKLOG")
@ResourceMenu(
        title = "Sprint Backlogs",
        group = "Project Management",
        icon = "clipboard-check",
        url = "/sprint-backlogs",
        order = 2,
        permission = "SPRINT_BACKLOG_READ"
)
public class SprintBacklog extends BaseEntity {

    /** Same limit enforced by {@code SprintBacklogServiceImpl}. */
    static final int MAX_TITLE_LENGTH = 200;

    /** Same limit enforced by {@code SprintBacklogServiceImpl}. */
    static final int MAX_DESCRIPTION_LENGTH = 2000;

    /**
     * Owning sprint. Optional: when it is {@code null} the item is still in the
     * product backlog and only waits to be assigned to a sprint.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sprint_id")
    @ImportField(name = "Sprint", lookupEntity = Sprint.class, lookupField = "name")
    Sprint sprint;

    /**
     * Owning project of the item (UFR-PRJ-003-02: every backlog item belongs
     * to a project).
     * <p>
     * It is derived by the service from the sprint, from the linked milestone
     * or from the explicit request value, so the UI never has to keep the two
     * in sync by itself.
     * <p>
     * Not importable on purpose: a file import has no project column, the
     * project is inherited from the selected sprint in {@link #prepareForImport()}.
     */
    @Column(name = "project_id")
    Long projectId;

    /**
     * Optional link to a milestone of the project (UFR-PRJ-003-02).
     * <p>
     * The milestone module owns the {@code milestones} table, so the relation
     * is read-only from this side: the service resolves and validates the
     * milestone (it must exist and still be active) before assigning it.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "milestone_id")
    Milestone milestone;

    /**
     * TEMPORARY assignee: only the raw project member id is stored until the
     * project member module is available.
     * <p>
     * Not importable on purpose: imported items stay unassigned ({@code null})
     * so the assignee is always picked deliberate in the backlog board.
     */
    @Column(name = "assignee_project_member_id")
    Long assigneeProjectMemberId;

    /**
     * TEMPORARY reporter: the team member who reported the item, stored as a
     * raw project member id like the assignee. Picked in the work item panel
     * of the backlog board.
     */
    @Column(name = "reporter_project_member_id")
    Long reporterProjectMemberId;

    /**
     * Item title: mandatory, 1..200 characters.
     */
    @Column(nullable = false, length = 200)
    @ImportField(name = "Title", required = true)
    String title;

    /**
     * Item description: optional, at most 2000 characters.
     */
    @Column(columnDefinition = "TEXT")
    @ImportField(name = "Description")
    String description;

    @Column(name = "start_date")
    @ImportField(name = "Start Date")
    LocalDateTime startDate;

    @Column(name = "end_date")
    @ImportField(name = "End Date")
    LocalDateTime endDate;

    /**
     * Lifecycle state. Not importable on purpose: every imported item starts
     * as {@link SprintBacklogStatus#TODO} and is advanced through the UI.
     */
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    SprintBacklogStatus status = SprintBacklogStatus.TODO;

    /**
     * Work type of the item: Story / Bug / Task. The set is FIXED (see
     * {@link SprintBacklogWorkType}): there is no endpoint to create new work
     * types, users only choose one of those values.
     */
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "work_type", length = 20)
    @ImportField(name = "Work Type")
    SprintBacklogWorkType workType = SprintBacklogWorkType.TASK;

    /**
     * Priority of the item, used by the backlog / planning board ordering and
     * by the priority filter of the backlog page.
     */
    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @ImportField(name = "Priority")
    SprintBacklogPriority priority = SprintBacklogPriority.MEDIUM;

    /**
     * Optional effort estimate in hours, used by the board capacity summary.
     */
    @Column(name = "estimated_hours")
    @ImportField(name = "Estimated Hours")
    Double estimatedHours;

    /**
     * Optimistic locking guard: a concurrent update of the same item makes the
     * second write fail with a conflict (409) instead of silently overwriting
     * the first one.
     */
    @Builder.Default
    @Version
    @Column(name = "version", nullable = false)
    Long version = 0L;

    /**
     * Primary key accessor matching the {@code sprint_backlog_id} column,
     * mirroring the {@code getSprintId()} convention of the sprint module.
     */
    public Long getSprintBacklogId() {
        return getId();
    }

    public void setSprintBacklogId(Long sprintBacklogId) {
        setId(sprintBacklogId);
    }

    /**
     * Import hook (bulk file import bypasses {@code SprintBacklogServiceImpl}).
     * <p>
     * Applies the same rules the REST create path enforces: trimmed title and
     * description with their length limits, start/end dates that are either
     * both present or both empty and in the right order, a non negative
     * estimate, the default lifecycle values and the project inherited from the
     * selected sprint.
     * <p>
     * Status, assignee and project are not part of the import file: every
     * imported item is forced to {@link SprintBacklogStatus#TODO}, stays
     * unassigned ({@code assigneeProjectMemberId} is {@code null}) and takes the
     * project of its sprint.
     */
    @PostImport
    void prepareForImport() {

        if (title != null) {
            title = title.trim();
            if (title.length() > MAX_TITLE_LENGTH) {
                throw new IllegalArgumentException(
                        "Title không vượt quá " + MAX_TITLE_LENGTH + " ký tự");
            }
        }

        if (description != null) {
            description = description.trim();
            if (description.length() > MAX_DESCRIPTION_LENGTH) {
                throw new IllegalArgumentException(
                        "Description không vượt quá " + MAX_DESCRIPTION_LENGTH + " ký tự");
            }
        }

        if ((startDate == null) != (endDate == null)) {
            throw new IllegalArgumentException(
                    "Start Date và End Date phải được nhập cùng nhau");
        }

        if (startDate != null && !startDate.isBefore(endDate)) {
            throw new IllegalArgumentException(
                    "Start Date phải trước End Date");
        }

        if (estimatedHours != null && estimatedHours < 0) {
            throw new IllegalArgumentException(
                    "Estimated Hours phải lớn hơn hoặc bằng 0");
        }

        if (projectId == null && sprint != null) {
            projectId = sprint.getProjectId();
        }

        if (isActive == null) {
            isActive = true;
        }

        // A file can never set the lifecycle: every imported item starts at TODO.
        status = SprintBacklogStatus.TODO;

        if (priority == null) {
            priority = SprintBacklogPriority.MEDIUM;
        }

        if (workType == null) {
            workType = SprintBacklogWorkType.DEFAULT;
        }
    }
}
