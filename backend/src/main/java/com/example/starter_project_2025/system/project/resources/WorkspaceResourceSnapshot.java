package com.example.starter_project_2025.system.project.resources;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

@Entity
@Table(name = "workspace_resource_snapshots", uniqueConstraints =
        @UniqueConstraint(name = "uk_workspace_resource_snapshot", columnNames = "workspace_id"))
@Immutable
@Getter
@Setter
@NoArgsConstructor
public class WorkspaceResourceSnapshot extends BaseEntity {
    @Column(name = "workspace_id", nullable = false, updatable = false)
    private Long workspaceId;

    @Column(name = "team_id", nullable = false, updatable = false)
    private Long teamId;

    @Column(name = "project_id", nullable = false, updatable = false)
    private Long projectId;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Lob
    @Column(name = "content_json", nullable = false, updatable = false)
    private String contentJson;
}
