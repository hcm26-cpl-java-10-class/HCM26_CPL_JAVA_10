package com.example.starter_project_2025.system.project.milestone.domain;

import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "milestones")
@ResourcePermission("MILESTONE")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Milestone {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "milestone_id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 2000)
    private String description;

    @Column(nullable = false)
    private Instant deadline;

    @Column(name = "is_mandatory", nullable = false)
    private boolean mandatory;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MilestoneStatus status;

    @Column(name = "rubric_snapshot_id", nullable = false, updatable = false)
    private UUID rubricSnapshotId;

    @Column(name = "reviewer_id", nullable = false)
    private UUID reviewerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "late_policy_type", nullable = false, length = 30)
    private LatePolicyType latePolicyType;

    @Column(name = "late_until")
    private Instant lateUntil;

    @Column(name = "late_penalty_percent", precision = 5, scale = 2)
    private BigDecimal latePenaltyPercent;

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
            UUID tenantId,
            UUID projectId,
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
}
