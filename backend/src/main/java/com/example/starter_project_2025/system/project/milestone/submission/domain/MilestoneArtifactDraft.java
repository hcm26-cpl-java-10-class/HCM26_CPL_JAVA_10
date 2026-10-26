package com.example.starter_project_2025.system.project.milestone.submission.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/** Mutable preparation data for a milestone. It is deliberately separate from official submission versions. */
@Entity
@Table(name = "milestone_artifact_drafts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MilestoneArtifactDraft {
    @Id
    @Column(name = "milestone_id", nullable = false, updatable = false)
    private UUID milestoneId;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "repository_url", length = 2048)
    private String repositoryUrl;

    @Column(name = "deployment_url", length = 2048)
    private String deploymentUrl;

    @Column(name = "release_notes", length = 10000)
    private String releaseNotes;

    @Column(name = "checklist_json", nullable = false, columnDefinition = "text")
    private String checklistJson;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_by", nullable = false)
    private UUID updatedBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Version
    @Column(nullable = false)
    private long version;

    public static MilestoneArtifactDraft create(UUID milestoneId, UUID projectId, UUID tenantId,
            UUID actorId, Instant now, String checklistJson) {
        MilestoneArtifactDraft draft = new MilestoneArtifactDraft();
        draft.milestoneId = milestoneId;
        draft.projectId = projectId;
        draft.tenantId = tenantId;
        draft.createdBy = actorId;
        draft.createdAt = now;
        draft.update(actorId, now, null, null, null, checklistJson);
        return draft;
    }

    public void update(UUID actorId, Instant now, String repositoryUrl, String deploymentUrl,
            String releaseNotes, String checklistJson) {
        this.repositoryUrl = repositoryUrl;
        this.deploymentUrl = deploymentUrl;
        this.releaseNotes = releaseNotes;
        this.checklistJson = checklistJson;
        this.updatedBy = actorId;
        this.updatedAt = now;
    }
}
