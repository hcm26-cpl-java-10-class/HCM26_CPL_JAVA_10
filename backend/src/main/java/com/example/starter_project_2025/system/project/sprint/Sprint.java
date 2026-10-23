package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.project.Project;
import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "sprint",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_sprint_project_name",
                columnNames = {"project_id", "name"}
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

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "project_id", nullable = false)
    @ImportField(name = "Project", required = true, lookupEntity = Project.class, lookupField = "name")
    @ExportField(name = "Project", relation = true, path = "name")
    Project project;

    @Column(length = 255)
    @ImportField(name = "Name")
    @ExportField(name = "Name")
    String name;

    @Column(name = "sprint_goal", length = 500)
    @ImportField(name = "Sprint Goal")
    @ExportField(name = "Sprint Goal")
    String sprintGoal;

    @Column(name = "start_date")
    @ImportField(name = "Start Date")
    @ExportField(name = "Start Date")
    LocalDateTime startDate;

    @Column(name = "end_date")
    @ImportField(name = "End Date")
    @ExportField(name = "End Date")
    LocalDateTime endDate;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    @ImportField(name = "Status")
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
}
