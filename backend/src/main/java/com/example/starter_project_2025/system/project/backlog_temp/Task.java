package com.example.starter_project_2025.system.project.backlog_temp;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

/**
 * Backlog task (temporary implementation).
 * <p>
 * TEMPORARY: the real task/backlog module is owned by another team member and
 * is not implemented yet. This class lives in {@code backlog_temp} so the
 * project module has working task CRUD in the meantime. When the official
 * module lands, delete this package and point the frontend to the new
 * {@code /api/tasks} owner.
 * <p>
 * Mapping notes (compared to the team's class diagram):
 * <ul>
 *     <li>{@code task_id} is a {@code Long} because {@link BaseEntity} (and the
 *     whole CRUD base: id filters, DTO ids, frontend types) is Long based, so
 *     the diagram's {@code uuid} type is adapted here.</li>
 *     <li>{@code project_id}, {@code sprint_id}, {@code milestone_id} and
 *     {@code assignee_project_member_id} are stored as plain identifiers: the
 *     owning modules are external to this repository, so no JPA relation is
 *     declared (same approach as {@code Sprint#projectId}). The milestone id
 *     is still validated against the temporary milestone catalog of this
 *     package, because UFR-PRJ-003-02 requires the link to point at an
 *     existing milestone of the same project (see {@link MilestoneLookup}).</li>
 *     <li>{@code created_at}/{@code updated_at} come from {@link BaseEntity}.</li>
 * </ul>
 * <p>
 * Validation rules (title length, workflow transitions, milestone link) live in
 * {@link TaskServiceImpl} so every failure surfaces as a business error
 * (422/404) instead of a generic bean validation error.
 */
@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "task")
@FieldDefaults(level = AccessLevel.PRIVATE)
@AttributeOverride(name = "id", column = @Column(name = "task_id"))
@ImportEntity("task")
@ExportEntity(fileName = "tasks", sheetName = "Tasks")
@ResourcePermission("TASK")
@ResourceMenu(
        title = "Tasks",
        group = "Project Management",
        icon = "tasks",
        url = "/taskstemp",
        order = 3,
        permission = "TASK_READ"
)
public class Task extends BaseEntity {

    /**
     * Owning project (required by the schema: {@code project_id ... NN}).
     * The project module is not available yet, so only the raw id is kept.
     */
    @Column(name = "project_id", nullable = false)
    @ImportField(name = "Project Id", required = true)
    @ExportField(name = "Project Id")
    Long projectId;

    @Column(name = "sprint_id")
    @ImportField(name = "Sprint Id")
    @ExportField(name = "Sprint Id")
    Long sprintId;

    /**
     * Position of the item inside its Sprint Backlog (1-based), used by
     * UFR-PRJ-003-03 to keep the priority order chosen during Sprint Planning.
     * {@code null} while the item lives in the product backlog.
     */
    @Column(name = "sprint_order")
    Integer sprintOrder;

    @Column(name = "milestone_id")
    @ImportField(name = "Milestone Id")
    @ExportField(name = "Milestone Id")
    Long milestoneId;

    @Column(name = "assignee_project_member_id")
    @ImportField(name = "Assignee Id")
    @ExportField(name = "Assignee Id")
    Long assigneeProjectMemberId;

    /**
     * Backlog item name: mandatory, 1..250 characters (business rule of
     * UFR-PRJ-003-02).
     */
    @Column(nullable = false, length = 250)
    @ImportField(name = "Title", required = true)
    @ExportField(name = "Title")
    String title;

    @Column(length = 2000)
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;

    @Column(name = "estimated_hours")
    @ImportField(name = "Estimated Hours")
    @ExportField(name = "Estimated Hours")
    Double estimatedHours;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @ImportField(name = "Priority")
    @ExportField(name = "Priority")
    TaskPriority priority = TaskPriority.MEDIUM;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @ImportField(name = "Status")
    @ExportField(name = "Status")
    TaskStatus status = TaskStatus.BACKLOG;

    /**
     * Primary key accessor matching the {@code task_id} column, mirroring the
     * {@code getSprintId()} convention used by the sprint module.
     */
    public Long getTaskId() {
        return getId();
    }

    public void setTaskId(Long taskId) {
        setId(taskId);
    }
}
