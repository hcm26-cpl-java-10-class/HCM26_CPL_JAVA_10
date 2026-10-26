package com.example.starter_project_2025.system.project.milestone.submission.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "milestone_waivers", uniqueConstraints = {
        @UniqueConstraint(name = "uk_milestone_waiver_team", columnNames = {"milestone_id", "team_id"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MilestoneWaiver {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "waiver_id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;
    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;
    @Column(name = "milestone_id", nullable = false, updatable = false)
    private UUID milestoneId;
    @Column(name = "team_id", nullable = false, updatable = false)
    private UUID teamId;
    @Column(nullable = false, length = 500)
    private String reason;
    @Column(name = "waived_by", nullable = false, updatable = false)
    private UUID waivedBy;
    @Column(name = "waived_at", nullable = false, updatable = false)
    private Instant waivedAt;

    public static MilestoneWaiver create(UUID tenantId, UUID projectId, UUID milestoneId,
                                         UUID teamId, String reason, UUID actorId, Instant now) {
        MilestoneWaiver waiver = new MilestoneWaiver();
        waiver.tenantId = tenantId;
        waiver.projectId = projectId;
        waiver.milestoneId = milestoneId;
        waiver.teamId = teamId;
        waiver.reason = reason.trim();
        waiver.waivedBy = actorId;
        waiver.waivedAt = now;
        return waiver;
    }
}
