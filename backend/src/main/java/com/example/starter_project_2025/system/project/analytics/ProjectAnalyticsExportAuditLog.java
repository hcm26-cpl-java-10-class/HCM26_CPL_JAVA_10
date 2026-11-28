package com.example.starter_project_2025.system.project.analytics;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

/**
 * US-ANL-010: immutable export audit log recording every CSV/XLSX/PDF analytics
 * report download with actor_id, timestamp, project_id, filter_scope,
 * export_format and correlation_id.
 */
@Entity
@Table(
        name = "project_analytics_export_audit_log",
        indexes = {
                @Index(name = "idx_analytics_export_audit_project", columnList = "project_id, exported_at"),
                @Index(name = "idx_analytics_export_audit_actor", columnList = "actor_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
public class ProjectAnalyticsExportAuditLog {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "actor_id", nullable = false, updatable = false)
    private Long actorId;

    @Column(name = "exported_at", nullable = false, updatable = false)
    private Instant timestamp;

    @Column(name = "project_id", nullable = false, updatable = false)
    private Long projectId;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "filter_scope", nullable = false, length = 500, updatable = false)
    private String filterScope;

    @Column(name = "export_format", nullable = false, length = 16, updatable = false)
    private String exportFormat;

    @Column(name = "correlation_id", nullable = false, length = 100, updatable = false)
    private String correlationId;
}
