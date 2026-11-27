package com.example.starter_project_2025.system.project.charter;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Immutable;
import java.time.Instant;

@Entity @Immutable @Getter @NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(name = "team_charter_confirmations", uniqueConstraints = @UniqueConstraint(
        name = "uk_charter_consent", columnNames = {"team_id", "revision_number", "user_id"}))
public class TeamCharterConfirmation {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "team_id", nullable = false, updatable = false) private Long teamId;
    @Column(name = "revision_number", nullable = false, updatable = false) private Long revisionNumber;
    @Column(name = "user_id", nullable = false, updatable = false) private Long userId;
    @Column(name = "roster_token", nullable = false, length = 64, updatable = false) private String rosterToken;
    @Column(name = "member_snapshot", nullable = false, columnDefinition = "TEXT", updatable = false) private String memberSnapshot;
    @Column(name = "confirmed_at", nullable = false, updatable = false) private Instant confirmedAt;
    @Column(name = "correlation_id", nullable = false, length = 100, updatable = false) private String correlationId;
    public TeamCharterConfirmation(Long teamId, Long revision, Long userId, String rosterToken,
                                   String memberSnapshot, Instant confirmedAt, String correlationId) {
        this.teamId = teamId; this.revisionNumber = revision; this.userId = userId; this.rosterToken = rosterToken;
        this.memberSnapshot = memberSnapshot; this.confirmedAt = confirmedAt; this.correlationId = correlationId;
    }
}
