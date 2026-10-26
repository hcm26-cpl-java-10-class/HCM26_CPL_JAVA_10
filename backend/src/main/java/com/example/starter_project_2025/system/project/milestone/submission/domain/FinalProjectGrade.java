package com.example.starter_project_2025.system.project.milestone.submission.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "final_project_grades", uniqueConstraints = {
        @UniqueConstraint(name = "uk_final_grade_project_team", columnNames = {"project_id", "team_id"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class FinalProjectGrade {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "final_grade_id", nullable = false, updatable = false)
    private UUID id;
    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;
    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;
    @Column(name = "team_id", nullable = false, updatable = false)
    private UUID teamId;
    @Column(name = "final_score", precision = 10, scale = 2)
    private BigDecimal finalScore;
    @Column(name = "locked_at")
    private Instant lockedAt;
    @Column(name = "locked_by")
    private UUID lockedBy;

    public static FinalProjectGrade locked(UUID tenantId, UUID projectId, UUID teamId,
                                           BigDecimal score, UUID actorId, Instant now) {
        FinalProjectGrade value = new FinalProjectGrade();
        value.tenantId = tenantId;
        value.projectId = projectId;
        value.teamId = teamId;
        value.finalScore = score.setScale(2, RoundingMode.HALF_UP);
        value.lockedAt = now;
        value.lockedBy = actorId;
        return value;
    }

    public void lock(BigDecimal score, UUID actorId, Instant now) {
        this.finalScore = score.setScale(2, RoundingMode.HALF_UP);
        this.lockedAt = now;
        this.lockedBy = actorId;
    }

    public boolean isLocked() { return lockedAt != null; }
}
