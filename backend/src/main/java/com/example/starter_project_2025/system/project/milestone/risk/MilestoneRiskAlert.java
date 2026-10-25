package com.example.starter_project_2025.system.project.milestone.risk;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;
@Entity @Table(name = "milestone_risk_alerts", uniqueConstraints = @UniqueConstraint(
        name = "uk_milestone_risk_actor_request", columnNames = {"actor_id", "request_id"}),
        indexes = @Index(name = "idx_milestone_risk_history", columnList = "milestone_id"))
@Getter @Setter @NoArgsConstructor
public class MilestoneRiskAlert {
    @Id private UUID id;
    @Column(nullable = false) private UUID projectId;
    @Column(name = "milestone_id", nullable = false) private UUID milestoneId;
    @Column(nullable = false) private Long tenantId;
    @Column(name = "actor_id", nullable = false) private Long actorId;
    @Column(name = "request_id", nullable = false) private UUID requestId;
    @Column(nullable = false, length = 64) private String requestHash;
    @Column(nullable = false, length = 500) private String warningNote;
    @Column(nullable = false) private int recipientCount;
    @Column(nullable = false) private Instant createdAt;
    @Column(nullable = false, length = 100) private String correlationId;
}
