package com.example.starter_project_2025.system.project.team;

import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import java.util.HashSet;
import java.util.Set;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "teams",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_team_code_tenant", columnNames = {"code", "tenant_id"}),
                @UniqueConstraint(name = "uk_team_project", columnNames = {"project_id"}),
                @UniqueConstraint(name = "uk_team_project_name", columnNames = {"project_id", "name"})
        }
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("TEAM")
public class Team extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String code;

    @Column(nullable = false, length = 255)
    private String name;

    @jakarta.persistence.OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "project_id")
    private Project project;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "mentor_id")
    private User mentor;

    @Column(length = 2000)
    private String mission;

    @Column(length = 2000)
    private String definitionOfDone;

    @Column(length = 255)
    private String primaryChannel;

    @Column(length = 255)
    private String coreHours;

    @Column(length = 2000)
    private String conflictResolution;

    @OneToMany(mappedBy = "team", fetch = FetchType.LAZY)
    private Set<TeamMember> members = new HashSet<>();

}
