package com.example.starter_project_2025.system.project.charter;

import com.example.starter_project_2025.system.project.ProjectTeam;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Immutable;

import java.time.Instant;

/** Append-only saved-content evidence. Existing charter content is never treated as consent. */
@Entity
@Table(name = "team_charter_revisions", uniqueConstraints =
        @UniqueConstraint(name = "uk_charter_team_revision", columnNames = {"team_id", "revision_number"}))
@Immutable
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
