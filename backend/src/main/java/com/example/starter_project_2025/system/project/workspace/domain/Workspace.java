package com.example.starter_project_2025.system.project.workspace.domain;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.team.Team;
import com.example.starter_project_2025.system.project.tenant.Tenant;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.OrderColumn;
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
import lombok.Builder;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "workspaces",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_workspace_tenant_team", columnNames = {"tenant_id", "team_id"})
        }
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("WORKSPACE")
@ResourceMenu(title = "Workspace", group = "Project Management", icon = "folder", url = "/management/workspaces/candidates", order = 3, permission = "WORKSPACE_READ")
public class Workspace extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "team_id", nullable = false)
    private ProjectTeam team;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private WorkspaceStatus status;

    @Column(name = "task_key_prefix", length = 8)
    @Builder.Default
    private String taskKeyPrefix = "FA";

    @Column(name = "board_columns_config", length = 2000)
    private String boardColumnsConfig;

    @Builder.Default
    @ElementCollection
    @CollectionTable(name = "workspace_sections", joinColumns = @JoinColumn(name = "workspace_id"),
            uniqueConstraints = @UniqueConstraint(name = "uk_workspace_section", columnNames = {"workspace_id", "section"}))
    @Enumerated(EnumType.STRING)
    @OrderColumn(name = "display_order")
    @Column(name = "section", nullable = false, length = 32)
    private List<WorkspaceSection> sections = new ArrayList<>();
}
