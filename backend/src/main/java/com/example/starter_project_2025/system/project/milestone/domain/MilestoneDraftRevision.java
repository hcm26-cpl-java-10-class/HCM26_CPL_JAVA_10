package com.example.starter_project_2025.system.project.milestone.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "milestone_draft_revisions", uniqueConstraints =
        @UniqueConstraint(name = "uk_milestone_draft_revision", columnNames = {"milestone_id", "revision_number"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MilestoneDraftRevision {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "milestone_id", nullable = false, updatable = false)
    private UUID milestoneId;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "revision_number", nullable = false, updatable = false)
    private int revisionNumber;

    @Column(name = "snapshot_json", nullable = false, updatable = false, columnDefinition = "TEXT")
    private String snapshotJson;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    public static MilestoneDraftRevision capture(Milestone milestone, int number, String snapshot,
                                                  UUID actor, Instant now) {
        MilestoneDraftRevision revision = new MilestoneDraftRevision();
        revision.milestoneId = milestone.getId();
        revision.tenantId = milestone.getTenantId();
        revision.revisionNumber = number;
        revision.snapshotJson = snapshot;
        revision.createdAt = now;
        revision.createdBy = actor;
        return revision;
    }
}
