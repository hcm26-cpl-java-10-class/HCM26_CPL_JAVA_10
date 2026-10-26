package com.example.starter_project_2025.system.project.milestone.submission.domain;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "milestone_submissions", uniqueConstraints = {
        @UniqueConstraint(name = "uk_submission_milestone_team", columnNames = {"milestone_id", "team_id"})
}, indexes = {
        @Index(name = "idx_submission_review_queue", columnList = "tenant_id,assigned_reviewer_id,status,submitted_at"),
        @Index(name = "idx_submission_project", columnList = "tenant_id,project_id")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MilestoneSubmission {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "submission_id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private UUID tenantId;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "milestone_id", nullable = false, updatable = false)
    private Milestone milestone;

    @Column(name = "team_id", nullable = false, updatable = false)
    private UUID teamId;

    @Column(name = "team_name", nullable = false, length = 120)
    private String teamName;

    @Column(name = "student_id", nullable = false, updatable = false)
    private UUID studentId;

    @Column(name = "student_name", nullable = false, length = 120)
    private String studentName;

    @Column(name = "assigned_reviewer_id", nullable = false)
    private UUID assignedReviewerId;

    @Column(name = "assigned_reviewer_name", nullable = false, length = 120)
    private String assignedReviewerName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SubmissionStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "execution_status", nullable = false, length = 30)
    private MilestoneExecutionStatus executionStatus;

    @Column(name = "current_version_number", nullable = false)
    private int currentVersionNumber;

    @Column(name = "submission_attempts", nullable = false)
    private int submissionAttempts;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Version
    @Column(name = "lock_version", nullable = false)
    private long lockVersion;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public static MilestoneSubmission create(Milestone milestone, UUID teamId, String teamName,
                                             UUID studentId, String studentName, UUID reviewerId,
                                             String reviewerName, Instant now) {
        MilestoneSubmission value = new MilestoneSubmission();
        value.tenantId = milestone.getTenantId();
        value.projectId = milestone.getProjectId();
        value.milestone = milestone;
        value.teamId = teamId;
        value.teamName = teamName;
        value.studentId = studentId;
        value.studentName = studentName;
        value.assignedReviewerId = reviewerId;
        value.assignedReviewerName = reviewerName;
        value.status = SubmissionStatus.DRAFT;
        value.executionStatus = MilestoneExecutionStatus.IN_PROGRESS;
        value.currentVersionNumber = 1;
        value.createdAt = now;
        value.updatedAt = now;
        return value;
    }

    public void submitted(int versionNumber, Instant now) {
        requireStatus(SubmissionStatus.DRAFT);
        currentVersionNumber = versionNumber;
        submissionAttempts++;
        status = SubmissionStatus.SUBMITTED;
        executionStatus = MilestoneExecutionStatus.REVIEW;
        submittedAt = now;
        reviewedAt = null;
        updatedAt = now;
    }

    public void reviewed(ReviewDecision decision, Instant now) {
        requireStatus(SubmissionStatus.SUBMITTED);
        switch (decision) {
            case ACCEPT -> {
                status = SubmissionStatus.ACCEPTED;
                executionStatus = MilestoneExecutionStatus.DONE;
            }
            case REJECT -> {
                status = SubmissionStatus.REJECTED;
                executionStatus = MilestoneExecutionStatus.FAILED;
            }
            case REQUEST_CHANGES -> {
                status = SubmissionStatus.CHANGES_REQUESTED;
                executionStatus = MilestoneExecutionStatus.IN_PROGRESS;
            }
        }
        reviewedAt = now;
        updatedAt = now;
    }

    public int openNextDraft(Instant now) {
        requireStatus(SubmissionStatus.CHANGES_REQUESTED);
        currentVersionNumber++;
        status = SubmissionStatus.DRAFT;
        executionStatus = MilestoneExecutionStatus.IN_PROGRESS;
        submittedAt = null;
        reviewedAt = null;
        updatedAt = now;
        return currentVersionNumber;
    }

    private void requireStatus(SubmissionStatus expected) {
        if (status != expected) {
            throw new IllegalStateException("Submission must be " + expected + " but is " + status);
        }
    }
}
