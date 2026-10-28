package com.example.starter_project_2025.system.project.domain;

import com.example.starter_project_2025.system.project.cohort.Cohort;
import com.example.starter_project_2025.system.project.tenant.Tenant;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "projects",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_project_code_tenant", columnNames = {"code", "tenant_id"})
        }
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("PROJECT")
public class Project extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(length = 2000)
    private String description;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", insertable = false, updatable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cohort_id")
    private Cohort cohort;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ProjectStatus status;

    /**
     * US-13: immutable evidence of the brief version the project was
     * materialised from ({@code project_template_version.snapshot_id}).
     * Written once, right after the team assignment snapshot is taken.
     */
    @Column(name = "template_snapshot_id")
    private Long templateSnapshotId;

    /**
     * US-13: training class the project was created for. Also reachable through
     * {@code ProjectTeam.trainingClass}, but stored here so the project row is
     * self-describing as required by the assignment flow.
     */
    @Column(name = "class_id")
    private Long classId;

    /**
     * US-13: team that owns the project ({@code project_teams.id}).
     */
    @Column(name = "team_id")
    private Long teamId;

    public void setTenant(Tenant tenant) {
        this.tenant = tenant;
        this.tenantId = tenant == null ? null : tenant.getId();
    }

    @jakarta.persistence.PrePersist
    @jakarta.persistence.PreUpdate
    private void initializeTenantId() {
        // Existing Workspace code and builders assign the association; Board assigns its ID.
        if (tenantId == null && tenant != null) tenantId = tenant.getId();
    }

}
