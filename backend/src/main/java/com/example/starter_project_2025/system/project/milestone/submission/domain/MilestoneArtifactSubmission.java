package com.example.starter_project_2025.system.project.milestone.submission.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "milestone_artifact_submissions", uniqueConstraints = {
        @UniqueConstraint(name = "uk_artifact_submission_version",
                columnNames = {"tenant_id", "project_id", "team_id", "milestone_id", "submitter_id", "version"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MilestoneArtifactSubmission {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "submission_id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, updatable = false)
    private Long tenantId;

    @Column(name = "project_id", updatable = false)
    private Long projectId;

    @Column(name = "team_id", updatable = false)
    private Long teamId;

    @Column(name = "milestone_id", nullable = false, updatable = false)
    private UUID milestoneId;

    @Column(name = "submitter_id", nullable = false, updatable = false)
    private UUID submitterId;

    @Column(nullable = false, updatable = false)
    private long version;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30, updatable = false)
    private ArtifactSubmissionStatus status;

    @Column(name = "repository_url", length = 2048, updatable = false)
    private String repositoryUrl;

    @Column(name = "deployment_url", length = 2048, updatable = false)
    private String deploymentUrl;

    @Column(name = "release_notes", columnDefinition = "text", updatable = false)
    private String releaseNotes;

    @Column(name = "checklist_json", nullable = false, columnDefinition = "text", updatable = false)
    private String checklistJson;

    @Column(name = "attachments_json", nullable = false, columnDefinition = "text", updatable = false)
    private String attachmentsJson;

    @Column(name = "submitted_at", nullable = false, updatable = false)
    private Instant submittedAt;

    @Column(name = "submitted_late", nullable = false, updatable = false)
    private boolean submittedLate;

    @Column(name = "late_penalty_percent", precision = 5, scale = 2, updatable = false)
    private BigDecimal latePenaltyPercent;

    public static MilestoneArtifactSubmission submit(Long tenantId, Long projectId, Long teamId, UUID milestoneId,
            UUID submitterId, long version, String repositoryUrl, String deploymentUrl, String releaseNotes,
            String checklistJson, String attachmentsJson, Instant submittedAt, boolean submittedLate,
            BigDecimal latePenaltyPercent) {
        MilestoneArtifactSubmission row = new MilestoneArtifactSubmission();
        row.tenantId = tenantId;
        row.projectId = projectId;
        row.teamId = teamId;
        row.milestoneId = milestoneId;
        row.submitterId = submitterId;
        row.version = version;
        row.status = ArtifactSubmissionStatus.SUBMITTED;
        row.repositoryUrl = repositoryUrl;
        row.deploymentUrl = deploymentUrl;
        row.releaseNotes = releaseNotes;
        row.checklistJson = checklistJson;
        row.attachmentsJson = attachmentsJson;
        row.submittedAt = submittedAt;
        row.submittedLate = submittedLate;
        row.latePenaltyPercent = latePenaltyPercent;
        return row;
    }

    public static MilestoneArtifactSubmission submit(Long tenantId, Long projectId, UUID milestoneId,
            UUID submitterId, long version, String repositoryUrl, String deploymentUrl, String releaseNotes,
            String checklistJson, String attachmentsJson, Instant submittedAt, boolean submittedLate,
            BigDecimal latePenaltyPercent) {
        return submit(tenantId, projectId, null, milestoneId, submitterId, version, repositoryUrl,
                deploymentUrl, releaseNotes, checklistJson, attachmentsJson, submittedAt,
                submittedLate, latePenaltyPercent);
    }
}
