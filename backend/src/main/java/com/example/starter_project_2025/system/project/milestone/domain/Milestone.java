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
    private static final UUID SCHEDULER_ACTOR_ID = UUID.nameUUIDFromBytes(
            "milestone-auto-scheduler".getBytes(java.nio.charset.StandardCharsets.UTF_8));

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

    @Column(name = "deadline_offset_days")
    private Integer deadlineOffsetDays;

    @Column(name = "auto_start_enabled", nullable = false, columnDefinition = "boolean default false")
    private boolean autoStartEnabled;

    @Column(name = "is_mandatory", nullable = false)
    private boolean mandatory;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private MilestoneStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "execution_status", length = 30)
    private com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus executionStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "lifecycle_status", length = 30)
    private MilestoneLifecycleStatus lifecycleState;

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
        milestone.lifecycleState = MilestoneLifecycleStatus.PLANNED;
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

    public void configureAutoStart(Integer offsetDays, boolean enabled) {
        if (offsetDays != null && (offsetDays < 0 || offsetDays > 365))
            throw new IllegalArgumentException("deadlineOffsetDays must be between 0 and 365");
        deadlineOffsetDays = offsetDays;
        autoStartEnabled = enabled;
    }

    public Instant scheduledStartAt() {
        return deadline == null || deadlineOffsetDays == null ? null
                : deadline.minus(Duration.ofDays(deadlineOffsetDays));
    }

    public void startAutomatically(Instant now) {
        if (!active || !autoStartEnabled || lifecycleStatus() != MilestoneLifecycleStatus.PLANNED
                || scheduledStartAt() == null || now.isBefore(scheduledStartAt())) return;
        if (status == MilestoneStatus.PLANNED) openForWork(SCHEDULER_ACTOR_ID, now);
        start(SCHEDULER_ACTOR_ID, now);
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
        if (status != MilestoneStatus.PLANNED)
            throw new IllegalStateException("Only a planned milestone can be opened");
        status = MilestoneStatus.OPEN;
        executionStatus = com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus.TODO;
        lifecycleState = MilestoneLifecycleStatus.PLANNED;
        updatedBy = actorId; updatedAt = now;
    }

    public MilestoneLifecycleStatus lifecycleStatus() {
        return lifecycleState == null ? MilestoneLifecycleStatus.of(status, executionStatus) : lifecycleState;
    }

    public void backfillLifecycle(MilestoneLifecycleStatus state) {
        if (lifecycleState == null) lifecycleState = state;
    }

    public void start(UUID actorId, Instant now) {
        if (lifecycleStatus() != MilestoneLifecycleStatus.PLANNED || status != MilestoneStatus.OPEN)
            throw new IllegalStateException("Only a published planned milestone can start");
        executionStatus = com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus.IN_PROGRESS;
        lifecycleState = MilestoneLifecycleStatus.IN_PROGRESS;
        updatedBy = actorId; updatedAt = now;
    }

    public void setExecutionStatus(com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus next, UUID actorId, Instant now) {
        if (status != MilestoneStatus.OPEN) throw new IllegalStateException("Milestone is not published");
        MilestoneLifecycleStatus current = lifecycleStatus();
        MilestoneLifecycleStatus target = switch (next) {
            case TODO -> MilestoneLifecycleStatus.PLANNED;
            case IN_PROGRESS -> MilestoneLifecycleStatus.IN_PROGRESS;
            case REVIEW -> MilestoneLifecycleStatus.SUBMITTED;
            case DONE -> MilestoneLifecycleStatus.ACCEPTED;
            case FAILED -> MilestoneLifecycleStatus.REJECTED;
        };
        boolean valid = switch (target) {
            case PLANNED -> false;
            case IN_PROGRESS -> current == MilestoneLifecycleStatus.PLANNED;
            case SUBMITTED -> current == MilestoneLifecycleStatus.IN_PROGRESS || current == MilestoneLifecycleStatus.CHANGES_REQUESTED;
            case CHANGES_REQUESTED -> false;
            case ACCEPTED, REJECTED -> current == MilestoneLifecycleStatus.SUBMITTED;
        };
        if (!valid) throw new IllegalStateException("Invalid milestone lifecycle transition: " + current + " -> " + target);
        lifecycleState = target;
        executionStatus = next; updatedBy = actorId; updatedAt = now;
    }

    public void requestChanges(UUID actorId, Instant now) {
        if (lifecycleStatus() != MilestoneLifecycleStatus.SUBMITTED)
            throw new IllegalStateException("Only a submitted milestone can request changes");
        lifecycleState = MilestoneLifecycleStatus.CHANGES_REQUESTED;
        executionStatus = com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus.IN_PROGRESS;
        updatedBy = actorId; updatedAt = now;
    }

    public void rejectExpired(UUID actorId, Instant now) {
        if (lifecycleStatus() != MilestoneLifecycleStatus.IN_PROGRESS)
            throw new IllegalStateException("Only an in-progress milestone can expire");
        lifecycleState = MilestoneLifecycleStatus.REJECTED;
        executionStatus = com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus.FAILED;
        updatedBy = actorId; updatedAt = now;
    }

    public void reconcileLegacySubmission(UUID actorId, Instant now) {
        if (lifecycleStatus() != MilestoneLifecycleStatus.PLANNED || status != MilestoneStatus.OPEN)
            throw new IllegalStateException("Only a legacy published milestone can be reconciled");
        lifecycleState = MilestoneLifecycleStatus.SUBMITTED;
        executionStatus = com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus.REVIEW;
        updatedBy = actorId; updatedAt = now;
    }

    public void editActive(String description, Instant deadline, UUID actorId, Instant now) {
        if (lifecycleStatus() != MilestoneLifecycleStatus.IN_PROGRESS || !active)
            throw new IllegalStateException("Only an in-progress milestone can be edited");
        description = description == null ? this.description : description;
        this.description = description;
        extendDeadline(deadline);
        updatedBy = actorId; updatedAt = now;
    }

    public void extendResubmission(Instant deadline, UUID actorId, Instant now) {
        if (lifecycleStatus() != MilestoneLifecycleStatus.CHANGES_REQUESTED || !active)
            throw new IllegalStateException("Only a changes-requested milestone can be extended");
        extendDeadline(deadline);
        updatedBy = actorId; updatedAt = now;
    }

    private void extendDeadline(Instant nextDeadline) {
        if (latePolicyType == LatePolicyType.ALLOW_LATE && lateUntil != null && deadline != null)
            lateUntil = nextDeadline.plus(Duration.between(deadline, lateUntil));
        deadline = nextDeadline;
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

    public void markAtRisk(UUID actorId, Instant now) {
        atRisk = true; updatedBy = actorId; updatedAt = now;
    }

    public void softDelete(UUID actorId, Instant now) {
        active = false; updatedBy = actorId; updatedAt = now;
    }
}
