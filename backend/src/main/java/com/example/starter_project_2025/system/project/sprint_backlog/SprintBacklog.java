package com.example.starter_project_2025.system.project.sprint_backlog;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
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
 * the owning side of the relation is this class ({@code sprint_id} is
 * mandatory).
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
                @Index(name = "idx_sprint_backlog_assignee", columnList = "assignee_project_member_id")
        }
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@AttributeOverride(name = "id", column = @Column(name = "sprint_backlog_id"))
@ResourcePermission("SPRINT_BACKLOG")
public class SprintBacklog extends BaseEntity {

    /**
     * Owning sprint. Mandatory: a backlog item always belongs to exactly one
     * sprint, and a sprint can own many backlog items.
     */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sprint_id", nullable = false)
    Sprint sprint;

    /**
     * TEMPORARY assignee: only the raw project member id is stored until the
     * project member module is available.
     */
    @Column(name = "assignee_project_member_id")
    Long assigneeProjectMemberId;

    /**
     * Item title: mandatory, 1..200 characters.
     */
    @Column(nullable = false, length = 200)
    String title;

    /**
     * Item description: optional, at most 2000 characters.
     */
    @Column(columnDefinition = "TEXT")
    String description;

    @Column(name = "start_date")
    LocalDateTime startDate;

    @Column(name = "end_date")
    LocalDateTime endDate;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    SprintBacklogStatus status = SprintBacklogStatus.TODO;

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
}
