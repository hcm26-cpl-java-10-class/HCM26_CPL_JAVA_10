package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.PostImport;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
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
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "sprint",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_sprint_name",
                columnNames = {"name"}
        )
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@AttributeOverride(name = "id", column = @Column(name = "sprint_id"))
@ImportEntity("sprint")
@ExportEntity(fileName = "sprints", sheetName = "Sprints")
@ResourcePermission("SPRINT")
@ResourceMenu(
        title = "Sprints",
        group = "Project Management",
        icon = "sprints",
        url = "/sprints",
        order = 1,
        permission = "SPRINT_READ"
)
public class Sprint extends BaseEntity {

    /**
     * Reference to the owning project.
     * <p>
     * The project module is owned by a different team, so the sprint feature
     * only keeps the raw identifier for now: no relation, no lookup, no
     * business rule relies on it. It is stored as a plain column so the data
     * is preserved and the relation can be re-introduced once the project
     * module is available again.
     */
    @Column(name = "project_id")
    @ImportField(name = "Project ID")
    Long projectId;

    @Column(name = "team_id")
    @ImportField(name = "Team ID")
    Long teamId;

    @Column(length = 255)
    @ImportField(name = "Name", required = true)
    @ExportField(name = "Name")
    String name;

    @Column(name = "sprint_goal", length = 500)
    @ImportField(name = "Sprint Goal", required = true)
    @ExportField(name = "Sprint Goal")
    String sprintGoal;

    @Column(name = "start_date")
    @ImportField(name = "Start Date", required = true)
    @ExportField(name = "Start Date")
    LocalDateTime startDate;

    /**
     * Backlog items of this sprint: one sprint has one or many Sprint Backlog
     * items. The owning side of the relation is {@link SprintBacklog#getSprint()}
     * ({@code sprint_backlog.sprint_id}), so the collection is only mapped to
     * allow reading the items from the sprint side.
     */
    @Builder.Default
    @OneToMany(mappedBy = "sprint", fetch = FetchType.LAZY)
    List<SprintBacklog> sprintBacklogs = new ArrayList<>();

    @Column(name = "end_date")
    @ImportField(name = "End Date", required = true)
    @ExportField(name = "End Date")
    LocalDateTime endDate;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    @ExportField(name = "Status")
    SprintStatus status = SprintStatus.PLANNED;

    /**
     * Optimistic locking guard: a concurrent update of the same sprint makes
     * the second write fail with a conflict (409) instead of silently
     * overwriting the first one.
     */
    @Builder.Default
    @Version
    @Column(name = "version", nullable = false)
    Long version = 0L;

    /**
     * Primary key. The {@code id} field is inherited from {@link BaseEntity}
     * (Long, IDENTITY) and is mapped to the {@code sprint_id} column by the
     * {@link AttributeOverride} declared on this class.
     */
    public Long getSprintId() {
        return getId();
    }

    public void setSprintId(Long sprintId) {
        setId(sprintId);
    }

    /**
     * Import hook (bulk file import bypasses {@code SprintServiceImpl}).
     * <p>
     * Applies the very same normalisation the REST create path performs:
     * trim the text fields, default the active flag, force the lifecycle back to
     * {@link SprintStatus#PLANNED} (a new sprint can only be started through an
     * update) and reject an end date that is not after the start date.
     */
    @PostImport
    void prepareForImport() {

        if (name != null) {
            name = name.trim();
        }

        if (sprintGoal != null) {
            sprintGoal = sprintGoal.trim();
        }

        if (isActive == null) {
            isActive = true;
        }

        status = SprintStatus.PLANNED;

        if (startDate != null && endDate != null && !startDate.isBefore(endDate)) {
            throw new IllegalArgumentException(
                    "Start Date phải trước End Date");
        }
    }
}
