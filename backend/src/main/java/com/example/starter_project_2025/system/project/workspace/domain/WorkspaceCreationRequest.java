package com.example.starter_project_2025.system.project.workspace.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "workspace_creation_requests", uniqueConstraints = @UniqueConstraint(
        name = "uk_workspace_request_key", columnNames = {"tenant_id", "actor_id", "idempotency_key"}))
@Getter @Setter @NoArgsConstructor
public class WorkspaceCreationRequest extends BaseEntity {
    @Column(name = "tenant_id", nullable = false) private Long tenantId;
    @Column(name = "actor_id", nullable = false) private Long actorId;
    @Column(name = "idempotency_key", nullable = false, length = 128) private String idempotencyKey;
    @Column(nullable = false, length = 64) private String payloadHash;
    @Column(nullable = false) private Long workspaceId;
    @Lob @Column(nullable = false) private String responseJson;
}
