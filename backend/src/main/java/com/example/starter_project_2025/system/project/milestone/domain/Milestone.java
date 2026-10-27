package com.example.starter_project_2025.system.project.milestone.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "milestones")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Milestone {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "milestone_id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "project_id", updatable = false)
    private Long projectId;

    @Column(name = "team_id", nullable = false, updatable = false)
    private Long teamId;

    @Column(nullable = false, length = 120)
    private String title;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false)
    private Instant deadline;

    @Column(name = "is_mandatory", nullable = false)
    private boolean mandatory;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MilestoneStatus status;

    @Column(name = "is_at_risk", nullable = false, columnDefinition = "boolean default false")
    private boolean atRisk;

    @Column(name = "is_active", nullable = false, columnDefinition = "boolean default true")
    private boolean active = true;

    @Column(name = "rubric_snapshot_id", nullable = false, updatable = false)
    private UUID rubricSnapshotId;

    // Reviewer assignment belongs to a submission, not to the milestone itself.
    // Keep the nullable legacy column so existing milestones can still be read.
    @Column(name = "reviewer_id")
    private UUID reviewerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "late_policy_type", nullable = false, length = 30)
    private LatePolicyType latePolicyType;

    @Column(name = "late_until")
    private Instant lateUntil;

    @Column(name = "late_penalty_percent", precision = 5, scale = 2)
    private BigDecimal latePenaltyPercent;

    @Enumerated(EnumType.STRING)
    @Column(name = "late_penalty_basis", nullable = false, columnDefinition = "varchar(20) default 'FIXED'")
    private LatePenaltyBasis latePenaltyBasis = LatePenaltyBasis.FIXED;

    @Column(precision = 5, scale = 2)
    private BigDecimal weight;

    @Version
    @Column(nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "created_by", nullable = false, updatable = false)
    private UUID createdBy;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "updated_by")
    private UUID updatedBy;

    @OneToMany(mappedBy = "milestone", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    private List<MilestoneChecklistItem> checklistItems = new ArrayList<>();

    public static Milestone create(
            Long tenantId,
            Long projectId,
            Long teamId,
            String title,
            String description,
            Instant deadline,
            boolean mandatory,
            UUID rubricSnapshotId,
            UUID reviewerId,
            LatePolicyType latePolicyType,
            Instant lateUntil,
            BigDecimal latePenaltyPercent,
            UUID actorId,
            Instant now
    ) {
        Milestone milestone = new Milestone();
        milestone.tenantId = tenantId;
        milestone.projectId = projectId;
        milestone.teamId = teamId;
        milestone.title = title;
        milestone.description = description;
        milestone.deadline = deadline;
        milestone.mandatory = mandatory;
        milestone.status = MilestoneStatus.PLANNED;
        milestone.rubricSnapshotId = rubricSnapshotId;
        milestone.reviewerId = reviewerId;
        milestone.latePolicyType = latePolicyType;
        milestone.lateUntil = lateUntil;
        milestone.latePenaltyPercent = latePenaltyPercent;
        milestone.createdAt = now;
        milestone.createdBy = actorId;
        milestone.updatedAt = now;
        milestone.updatedBy = actorId;
        return milestone;
    }

    public void addChecklistItem(String content, boolean mandatory, int orderIndex) {
        checklistItems.add(MilestoneChecklistItem.create(this, content, mandatory, orderIndex));
    }

    public void configureAssessment(BigDecimal weight, LatePenaltyBasis penaltyBasis) {
        this.weight = weight;
        this.latePenaltyBasis = latePolicyType == LatePolicyType.ALLOW_LATE && penaltyBasis != null
                ? penaltyBasis : LatePenaltyBasis.FIXED;
    }

    public BigDecimal latePenaltyAt(Instant submittedAt) {
        if (!submittedAt.isAfter(deadline) || latePolicyType != LatePolicyType.ALLOW_LATE || latePenaltyPercent == null) return null;
        if (latePenaltyBasis != LatePenaltyBasis.PER_DAY) return latePenaltyPercent;
        Duration elapsed = Duration.between(deadline, submittedAt);
        long days = elapsed.toDays();
        if (!elapsed.minusDays(days).isZero()) days++;
        return latePenaltyPercent.multiply(BigDecimal.valueOf(days)).min(new BigDecimal("100"));
    }

    public void openForWork(UUID actorId, Instant now) {
        if (status != MilestoneStatus.PLANNED && status != MilestoneStatus.OPEN)
            throw new IllegalStateException("Only a planned milestone can be opened");
        status = MilestoneStatus.OPEN; updatedBy = actorId; updatedAt = now;
    }

    public void markAtRisk(UUID actorId, Instant now) {
        atRisk = true; updatedBy = actorId; updatedAt = now;
    }

    public void softDelete(UUID actorId, Instant now) {
        active = false; updatedBy = actorId; updatedAt = now;
    }
}
