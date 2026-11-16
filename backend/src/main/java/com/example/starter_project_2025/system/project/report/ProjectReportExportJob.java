package com.example.starter_project_2025.system.project.report;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name="project_report_exports",uniqueConstraints=@UniqueConstraint(name="uk_report_export_request",columnNames={"actor_id","request_id"}),
        indexes={@Index(name="idx_report_export_worker",columnList="status,created_at"),@Index(name="idx_report_export_owner",columnList="tenant_id,actor_id,created_at")})
@Getter @Setter @NoArgsConstructor
public class ProjectReportExportJob {
    public enum State { QUEUED,RUNNING,READY,FAILED,EXPIRED }
    @Id private UUID id;
    @Column(name="actor_id",nullable=false,updatable=false) private Long actorId;
    @Column(name="tenant_id",nullable=false,updatable=false) private Long tenantId;
    @Column(name="request_id",nullable=false,updatable=false) private UUID requestId;
    @Column(nullable=false,length=64,updatable=false) private String fingerprint;
    @Column(name="correlation_id",nullable=false,length=100,updatable=false) private String correlationId;
    @Column(name="filters_json",nullable=false,columnDefinition="TEXT",updatable=false) private String filtersJson;
    @Column(nullable=false,length=10,updatable=false) private String format;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=16) private State status;
    @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
    @Column(name="started_at") private Instant startedAt;
    @Column(name="generated_at") private Instant generatedAt;
    @Column(name="expires_at") private Instant expiresAt;
    @Column(name="row_count") private Long rowCount;
    @Column(name="project_ids",columnDefinition="TEXT") private String projectIds;
    @Column(name="file_name",length=160) private String fileName;
    @Lob @Basic(fetch=FetchType.LAZY) @Column(name="file_content") private byte[] fileContent;
    @Column(length=300) private String message;
    @Version private long version;
}
