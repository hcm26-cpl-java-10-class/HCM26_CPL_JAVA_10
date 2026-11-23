package com.example.starter_project_2025.system.project.milestone.submission.domain;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import jakarta.persistence.*;
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
public class MilestoneArtifactDraft implements org.springframework.data.domain.Persistable<UUID> {
    @Id
    @Column(name = "milestone_id", nullable = false, updatable = false)
    private UUID milestoneId;

    /** One draft per milestone: the draft shares the milestone's primary key. */
    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "milestone_id", foreignKey = @ForeignKey(name = "fk_artifact_draft_milestone"))
    private Milestone milestone;

    @Column(name = "project_id", updatable = false)
    private Long projectId;

    @Column(name = "team_id", updatable = false)
    private Long teamId;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "repository_url", length = 2048)
    private String repositoryUrl;

    @Column(name = "deployment_url", length = 2048)
    private String deploymentUrl;

    @Column(name = "release_notes", columnDefinition = "text")
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

    /**
     * The id is assigned from the milestone (shared primary key) and the version is primitive, so Spring Data
     * cannot infer "new" from either; track it explicitly so a new draft is persisted instead of merged.
     */
    @Transient
    private boolean persisted;

    @PostLoad
    @PostPersist
    void markPersisted() { persisted = true; }

    @Override
    public UUID getId() { return milestoneId; }

    @Override
    public boolean isNew() { return !persisted; }

    public static MilestoneArtifactDraft create(Milestone milestone, Long projectId, Long teamId, Long tenantId,
            UUID actorId, Instant now, String checklistJson) {
        MilestoneArtifactDraft draft = new MilestoneArtifactDraft();
        draft.milestone = milestone;
        draft.milestoneId = milestone.getId();
        draft.projectId = projectId;
        draft.teamId = teamId;
        draft.tenantId = tenantId;
        draft.createdBy = actorId;
        draft.createdAt = now;
        draft.update(actorId, now, null, null, null, checklistJson);
        return draft;
    }

    public static MilestoneArtifactDraft create(Milestone milestone, Long projectId, Long tenantId,
            UUID actorId, Instant now, String checklistJson) {
        return create(milestone, projectId, null, tenantId, actorId, now, checklistJson);
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
