package com.example.starter_project_2025.system.project.workspace.git;

import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import jakarta.persistence.*;
import java.time.Instant;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One current configuration per workspace; unlink retains its revision. */
@Entity
@Table(name = "project_git_configs")
@Getter @Setter @NoArgsConstructor
public class ProjectGitConfig {
    @Id @Column(name = "workspace_id") private Long workspaceId;
    // workspace_id is also the PK, so the database enforces one config/workspace.
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workspace_id", insertable = false, updatable = false, foreignKey = @ForeignKey(name = "fk_project_git_workspace"))
    private Workspace workspace;
    @Column(name = "tenant_id", nullable = false, updatable = false) private Long tenantId;
    @Column(name = "team_id", nullable = false, updatable = false) private Long teamId;
    @Column(name = "repository_url", length = 2048) private String repositoryUrl;
    @Column(name = "repository_web_url", length = 2048) private String repositoryWebUrl;
    @Column(length = 32) private String provider;
    @Column(name = "default_branch", length = 255) private String defaultBranch;
    // Incremented under a pessimistic workspace lock, including create/unlink.
    @Column(nullable = false) private long version;
    @Column(name = "created_at", nullable = false, updatable = false) private Instant createdAt;
    @Column(name = "created_by", nullable = false, updatable = false) private Long createdBy;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;
    @Column(name = "updated_by", nullable = false) private Long updatedBy;
}
