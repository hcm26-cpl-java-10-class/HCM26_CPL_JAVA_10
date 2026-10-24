package com.example.starter_project_2025.system.project.backlog_temp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

/**
 * Read-only milestone reference used by the temporary backlog module.
 * <p>
 * TEMPORARY: the milestone module belongs to the project team and is not part
 * of this repository yet, but UFR-PRJ-003-02 requires a backlog item to be
 * linked to an existing milestone of the same project (AC03: linking a
 * cancelled / unknown milestone must answer {@code 404}). To validate that
 * link without owning another team's schema, this minimal catalog lives in the
 * {@code backlog_temp} package, exactly like {@link Task}. When the official
 * milestone module lands, delete this class (and {@link MilestoneRepository},
 * {@link MilestoneLookup}, {@link MilestoneDataInitializer}) and delegate the
 * lookup to that module.
 */
@Entity
@Table(
        name = "backlog_milestone",
        indexes = @Index(name = "idx_backlog_milestone_project", columnList = "project_id")
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Milestone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "milestone_id")
    Long id;

    @Column(name = "project_id", nullable = false)
    Long projectId;

    @Column(nullable = false, length = 250)
    String name;

    @Column(length = 2000)
    String description;

    @Column(name = "due_date")
    LocalDate dueDate;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    MilestoneStatus status = MilestoneStatus.PLANNED;

    public boolean isLinkable() {
        return status == null || status.isLinkable();
    }
}
