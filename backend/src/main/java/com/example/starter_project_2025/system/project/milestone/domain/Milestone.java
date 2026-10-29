package com.example.starter_project_2025.system.project.milestone.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.ColumnDefault;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "milestones", indexes = {
        @Index(name = "idx_milestone_tenant_team", columnList = "tenant_id,team_id,is_active,deadline"),
        @Index(name = "idx_milestone_tenant_project", columnList = "tenant_id,project_id,is_active,deadline")
})
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

    @Column
    private Instant deadline;

    @Column(name = "is_mandatory", nullable = false)
    private boolean mandatory;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MilestoneStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "execution_status", length = 30)
    private com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus executionStatus;

    @Column(name = "is_at_risk", nullable = false, columnDefinition = "boolean default false")
    private boolean atRisk;

    @Column(name = "is_active", nullable = false, columnDefinition = "boolean default true")
    private boolean active = true;

    @Column(name = "rubric_snapshot_id")
    private UUID rubricSnapshotId;

    // Reviewer assignment belongs to a submission, not to the milestone itself.
    // Keep the nullable legacy column so existing milestones can still be read.
    @Column(name = "reviewer_id")
    private UUID reviewerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "late_policy_type", length = 30)
    private LatePolicyType latePolicyType;

    @Column(name = "late_until")
    private Instant lateUntil;

    @Column(name = "late_penalty_percent", precision = 5, scale = 2)
    private BigDecimal latePenaltyPercent;

    @Column(name = "allow_resubmission", nullable = false)
    @ColumnDefault("true")
    private boolean allowResubmission;

    @Column(name = "max_submission_attempts")
    @ColumnDefault("3")
    private Integer maxSubmissionAttempts;

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
        milestone.allowResubmission = true;
        milestone.maxSubmissionAttempts = 3;
        milestone.createdAt = now;
        milestone.createdBy = actorId;
        milestone.updatedAt = now;
        milestone.updatedBy = actorId;
        return milestone;
    }

    public void configureResubmission(boolean allowed, Integer maxAttempts) {
        this.allowResubmission = allowed;
        this.maxSubmissionAttempts = allowed ? maxAttempts : null;
    }

    public void addChecklistItem(String content, boolean mandatory, int orderIndex) {
        checklistItems.add(MilestoneChecklistItem.create(this, content, mandatory, orderIndex));
    }

    public void replaceChecklist(List<com.example.starter_project_2025.system.project.milestone.dto.request.ChecklistItemRequest> items) {
        checklistItems.clear();
        if (items != null) for (int index = 0; index < items.size(); index++) {
            var item = items.get(index);
            if (item != null && item.content() != null && !item.content().isBlank())
                addChecklistItem(item.content().trim(), item.mandatory(), item.orderIndex() == null ? index : item.orderIndex());
        }
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
        status = MilestoneStatus.OPEN;
        executionStatus = com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus.TODO;
        updatedBy = actorId; updatedAt = now;
    }

    public void start(UUID actorId, Instant now) {
        if (status != MilestoneStatus.OPEN || executionStatus != com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus.TODO)
            throw new IllegalStateException("Only a published TODO milestone can start");
        executionStatus = com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus.IN_PROGRESS;
        updatedBy = actorId; updatedAt = now;
    }

    public void setExecutionStatus(com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus next, UUID actorId, Instant now) {
        if (status != MilestoneStatus.OPEN) throw new IllegalStateException("Milestone is not published");
        executionStatus = next; updatedBy = actorId; updatedAt = now;
    }

    public void editDraft(String title, String description, Instant deadline, boolean mandatory,
                          UUID rubricSnapshotId, LatePolicyType latePolicyType, Instant lateUntil,
                          BigDecimal latePenaltyPercent, BigDecimal weight, UUID actorId, Instant now) {
        if (status != MilestoneStatus.PLANNED || !active) throw new IllegalStateException("Only an active draft can be edited");
        this.title = title; this.description = description; this.deadline = deadline;
        this.mandatory = mandatory; this.rubricSnapshotId = rubricSnapshotId;
        this.latePolicyType = latePolicyType; this.lateUntil = lateUntil;
        this.latePenaltyPercent = latePenaltyPercent; this.weight = weight;
        this.updatedBy = actorId; this.updatedAt = now;
    }

    public void editPublishedMetadata(String title, String description, Instant deadline, UUID actorId, Instant now) {
        if (status != MilestoneStatus.OPEN || !active) throw new IllegalStateException("Only a published milestone can be edited");
        this.title = title; this.description = description; this.deadline = deadline;
        this.updatedBy = actorId; this.updatedAt = now;
    }

    public void markAtRisk(UUID actorId, Instant now) {
        atRisk = true; updatedBy = actorId; updatedAt = now;
    }

    public void softDelete(UUID actorId, Instant now) {
        active = false; updatedBy = actorId; updatedAt = now;
    }
}
