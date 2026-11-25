package com.example.starter_project_2025.system.project.milestone.submission.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "project_completion_audits")
@Getter
@NoArgsConstructor
public class ProjectCompletionAudit {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    @Column(nullable = false, updatable = false)
    private Long tenantId;
    @Column(nullable = false, updatable = false)
    private Long projectId;
    @Column(updatable = false)
    private Long teamId;
    @Column(nullable = false, updatable = false)
    private UUID actorId;
    @Column(nullable = false, updatable = false, length = 50)
    private String action;
    @Column(updatable = false, length = 500)
    private String detail;
    @Column(nullable = false, updatable = false)
    private Instant occurredAt;
    @Column(nullable = false, updatable = false, length = 100)
    private String correlationId;

    public ProjectCompletionAudit(Long tenantId, Long projectId, Long teamId, UUID actorId,
                                  String action, String detail, Instant now, String correlationId) {
        this.tenantId = tenantId; this.projectId = projectId; this.teamId = teamId; this.actorId = actorId;
        this.action = action; this.detail = detail; this.occurredAt = now; this.correlationId = correlationId;
    }
}
