package com.example.starter_project_2025.system.project.charter;

import com.example.starter_project_2025.system.project.ProjectTeam;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** Saved content is immutable. Workflow transitions attach approval and publication metadata. */
@Entity
@Table(name = "team_charter_revisions", uniqueConstraints =
        @UniqueConstraint(name = "uk_charter_team_revision", columnNames = {"team_id", "revision_number"}))
@Getter
@NoArgsConstructor(access = lombok.AccessLevel.PROTECTED)
public class TeamCharterRevision {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "team_id", nullable = false, updatable = false)
    private ProjectTeam team;
    @Column(name = "revision_number", nullable = false, updatable = false)
    private Long revisionNumber;
    @Column(name = "content_json", nullable = false, updatable = false, columnDefinition = "LONGTEXT")
    private String contentJson;
    @Column(name = "actor_id", nullable = false, updatable = false)
    private Long actorId;
    @Column(name = "saved_at", nullable = false, updatable = false)
    private Instant savedAt;
    @Column(name = "correlation_id", nullable = false, updatable = false, length = 100)
    private String correlationId;
    @Column(name = "approved_at")
    private Instant approvedAt;
    @Column(name = "approved_by")
    private Long approvedBy;
    @Column(name = "published_at")
    private Instant publishedAt;
    @Column(name = "published_by")
    private Long publishedBy;

    void approve(Long userId, Instant time) {
        approvedBy = userId;
        approvedAt = time;
    }

    void publish(Long userId, Instant time) {
        publishedBy = userId;
        publishedAt = time;
    }

    public TeamCharterRevision(ProjectTeam team, Long revisionNumber, String contentJson,
                               Long actorId, Instant savedAt, String correlationId) {
        this.team = team;
        this.revisionNumber = revisionNumber;
        this.contentJson = contentJson;
        this.actorId = actorId;
        this.savedAt = savedAt;
        this.correlationId = correlationId;
    }
}
