package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "workspace_audits", uniqueConstraints = @UniqueConstraint(name = "uk_workspace_audit_event", columnNames = "event_id"))
@Getter @Setter @NoArgsConstructor
public class WorkspaceAudit extends BaseEntity {
    @Column(name = "event_id", nullable = false, length = 36) private String eventId;
    @Column(nullable = false) private Long tenantId;
    @Column(name = "actor_id", nullable = false) private Long actorId;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_id", insertable = false, updatable = false)
    private com.example.starter_project_2025.system.rbac.user.User actor;
    @Column(nullable = false) private Long workspaceId;
    @Column(nullable = false) private Long projectId;
    @Column(nullable = false) private Long teamId;
    @Column(nullable = false, length = 40) private String action;
    @Column(nullable = false, length = 64) private String correlationId;
    @Lob @Column(nullable = false) private String beforeJson;
    @Lob @Column(nullable = false) private String afterJson;
}
