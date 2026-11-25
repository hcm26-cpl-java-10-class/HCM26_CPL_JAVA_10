package com.example.starter_project_2025.system.project.workspace.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.Instant;

@Entity
@Table(name = "workspace_activities", uniqueConstraints = @UniqueConstraint(name = "uk_workspace_activity_event", columnNames = "event_id"))
@Getter @Setter @NoArgsConstructor
public class WorkspaceActivity extends BaseEntity {
    @Column(name = "event_id", nullable = false, length = 36) private String eventId;
    @Column(nullable = false) private Long tenantId;
    @Column(nullable = false) private Long actorId;
    @Column(nullable = false) private Long workspaceId;
    @Column(nullable = false, length = 40) private String action;
    @Column(nullable = false, length = 64) private String correlationId;
    @Column(nullable = false) private Instant occurredAt;
}
