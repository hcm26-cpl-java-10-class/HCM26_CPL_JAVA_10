package com.example.starter_project_2025.system.project.report;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.Instant;
import java.util.UUID;

@Entity @Table(name="project_report_export_audits",indexes=@Index(name="idx_report_export_audit_job",columnList="job_id,occurred_at"))
@Getter @Setter @NoArgsConstructor
public class ProjectReportExportAudit {
    @Id private UUID id;
    @Column(name="job_id",nullable=false,updatable=false) private UUID jobId;
    @Column(name="actor_id",nullable=false,updatable=false) private Long actorId;
    @Column(name="tenant_id",nullable=false,updatable=false) private Long tenantId;
    @Column(nullable=false,length=32,updatable=false) private String action;
    @Column(name="occurred_at",nullable=false,updatable=false) private Instant occurredAt;
    @Column(name="correlation_id",nullable=false,length=100,updatable=false) private String correlationId;
}
