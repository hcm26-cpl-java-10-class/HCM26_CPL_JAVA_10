package com.example.starter_project_2025.system.project.workspace.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.PreRemove;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "project_log_audits", uniqueConstraints =
        @UniqueConstraint(name = "uk_project_log_audit_event", columnNames = "event_id"))
@Getter
@Setter
@NoArgsConstructor
public class ProjectLogAudit {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false, updatable = false, length = 36)
    private String eventId;

    @Column(name = "workspace_id", nullable = false, updatable = false)
    private Long workspaceId;

    @Column(name = "project_id", updatable = false)
    private Long projectId;

    @Column(name = "log_id", nullable = false, updatable = false)
    private Long logId;

    @Column(name = "actor_id", nullable = false, updatable = false)
    private Long actorId;

    @Column(nullable = false, updatable = false)
    private Instant timestamp;

    @Column(nullable = false, updatable = false, length = 64)
    private String correlationId;

    @Column(length = 64, updatable = false)
    private String ip;

    @Column(nullable = false, updatable = false, length = 30)
    private String action;

    @Lob
    @Column(name = "before_json", nullable = false, updatable = false)
    private String beforeJson;

    @Lob
    @Column(name = "after_json", nullable = false, updatable = false)
    private String afterJson;

    @PreUpdate
    @PreRemove
    private void immutable() {
        throw new IllegalStateException("Project log audit records are immutable");
    }
}
