package com.example.starter_project_2025.system.project.milestone.submission.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "milestone_artifact_attachments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ArtifactAttachment {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "attachment_id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "milestone_id", nullable = false, updatable = false)
    private UUID milestoneId;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "storage_key", nullable = false, unique = true, updatable = false, length = 36)
    private String storageKey;

    @Column(name = "original_name", nullable = false, updatable = false, length = 255)
    private String originalName;

    @Column(name = "content_type", nullable = false, updatable = false, length = 150)
    private String contentType;

    @Column(name = "size_bytes", nullable = false, updatable = false)
    private long sizeBytes;

    @Column(name = "scan_status", nullable = false, updatable = false, length = 20)
    private String scanStatus;

    @Column(name = "uploaded_by", nullable = false, updatable = false)
    private UUID uploadedBy;

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private Instant uploadedAt;

    public static ArtifactAttachment clean(UUID milestoneId, UUID projectId, UUID tenantId,
            String storageKey, String originalName, String contentType, long sizeBytes,
            UUID actorId, Instant now) {
        ArtifactAttachment attachment = new ArtifactAttachment();
        attachment.milestoneId = milestoneId;
        attachment.projectId = projectId;
        attachment.tenantId = tenantId;
        attachment.storageKey = storageKey;
        attachment.originalName = originalName;
        attachment.contentType = contentType;
        attachment.sizeBytes = sizeBytes;
        attachment.scanStatus = "CLEAN";
        attachment.uploadedBy = actorId;
        attachment.uploadedAt = now;
        return attachment;
    }
}
