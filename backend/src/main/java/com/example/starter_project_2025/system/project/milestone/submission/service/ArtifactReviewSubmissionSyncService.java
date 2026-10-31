package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.submission.domain.*;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneArtifactSubmissionRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneSubmissionRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneReviewRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.SubmissionVersionRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Bridges immutable artifact submissions into the reviewer-facing submission workflow. */
@Service
@RequiredArgsConstructor
public class ArtifactReviewSubmissionSyncService {

    private final MilestoneSubmissionRepository submissions;
    private final SubmissionVersionRepository versions;
    private final MilestoneReviewRepository reviews;
    private final MilestoneArtifactSubmissionRepository artifactSubmissions;
    private final ProjectTeamRepository teams;
    private final UserRepository users;
    private final SubmissionQueryService submissionQueryService;

    public record ArtifactReviewState(String status, UUID reviewSubmissionId) { }

    public UUID synchronize(Milestone milestone, MilestoneArtifactSubmission artifact) {
        var alreadyLinked = versions.findByArtifactSubmissionId(artifact.getId());
        if (alreadyLinked.isPresent()) return alreadyLinked.get().getSubmission().getId();
        if (artifact.getTeamId() == null) return null;

        var team = teams.findByIdAndTrainingClass_TenantId(artifact.getTeamId(), artifact.getTenantId())
                .orElse(null);
        if (team == null) return null;

        User student = findByActorId(artifact.getTenantId(), artifact.getSubmitterId());
        User mentor = team.getAssignedMentorId() == null ? null
                : users.findByIdAndIsActiveTrue(team.getAssignedMentorId()).orElse(null);
        UUID reviewerId = mentor == null
                ? UUID.nameUUIDFromBytes(("team-reviewer:" + team.getId()).getBytes(StandardCharsets.UTF_8))
                : actorId(mentor);
        String reviewerName = mentor == null ? "Workspace reviewer" : mentor.getFullName();
        String studentName = student == null ? "Team member" : student.getFullName();

        MilestoneSubmission submission = submissions.findByMilestoneIdAndTeamId(milestone.getId(), team.getId())
                .orElseGet(() -> submissions.saveAndFlush(MilestoneSubmission.create(
                        milestone, team.getId(), team.getTeamName(), artifact.getSubmitterId(), studentName,
                        reviewerId, reviewerName, artifact.getSubmittedAt())));

        SubmissionVersion version;
        if (submission.getStatus() == SubmissionStatus.CHANGES_REQUESTED) {
            // Guard: Never allow an older artifact submitted at or before reviewedAt to reopen a reviewed submission
            if (submission.getReviewedAt() != null && !artifact.getSubmittedAt().isAfter(submission.getReviewedAt())) {
                return submission.getId();
            }
            if (!submissionQueryService.canRequestChanges(submission)) {
                throw new com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException(
                        java.util.Map.of("submission", java.util.List.of(
                                "Không thể nộp lại do Milestone đã hết hạn theo Late Policy")));
            }
            int number = submission.openNextDraft(artifact.getSubmittedAt());
            version = createVersion(submission, artifact, milestone, number);
        } else if (submission.getStatus() == SubmissionStatus.DRAFT) {
            version = versions.findBySubmissionIdAndVersionNumber(submission.getId(), submission.getCurrentVersionNumber())
                    .orElseGet(() -> createVersion(submission, artifact, milestone, submission.getCurrentVersionNumber()));
            version.updateDraft(versionTitle(milestone, artifact), artifact.getReleaseNotes(), primaryUrl(artifact));
            if (version.getArtifacts().isEmpty()) addArtifacts(version, artifact);
            if (version.getChecklist().isEmpty()) snapshotChecklist(version, milestone);
        } else if (submission.getStatus() == SubmissionStatus.SUBMITTED) {
            version = versions.findBySubmissionIdAndVersionNumber(submission.getId(), submission.getCurrentVersionNumber())
                    .orElse(null);
            if (version != null) {
                if (version.getArtifactSubmissionId() == null) {
                    version.linkArtifactSubmission(artifact.getId());
                    versions.save(version);
                } else if (!version.getArtifactSubmissionId().equals(artifact.getId())) {
                    throw new com.example.starter_project_2025.system.project.milestone.exception.MilestoneConflictException(
                            "Submitted version is immutable; request changes before resubmitting");
                }
            }
            return submission.getId();
        } else {
            return submission.getId();
        }

        version.linkArtifactSubmission(artifact.getId());
        version.submit(artifact.getSubmittedAt(), artifact.isSubmittedLate(), artifact.getLatePenaltyPercent());
        submission.submitted(version.getVersionNumber(), artifact.getSubmittedAt());
        milestone.setExecutionStatus(MilestoneExecutionStatus.REVIEW, artifact.getSubmitterId(), artifact.getSubmittedAt());
        versions.save(version);
        submissions.saveAndFlush(submission);
        return submission.getId();
    }

    public ArtifactReviewState resolveViewState(Milestone milestone,
                                                MilestoneArtifactSubmission artifact,
                                                boolean isLatestForMilestone) {
        if (milestone == null || artifact.getTeamId() == null) {
            return new ArtifactReviewState(artifact.getStatus().name(), null);
        }
        if (isLatestForMilestone) {
            synchronize(milestone, artifact);
        }
        var submissionOpt = submissions.findByMilestoneIdAndTeamId(milestone.getId(), artifact.getTeamId());
        if (submissionOpt.isEmpty()) {
            return new ArtifactReviewState(artifact.getStatus().name(), null);
        }
        MilestoneSubmission submission = submissionOpt.get();
        var linkedVersion = versions.findByArtifactSubmissionId(artifact.getId());

        if (isLatestForMilestone) {
            if (submission.getStatus() != SubmissionStatus.SUBMITTED
                    && submission.getStatus() != SubmissionStatus.DRAFT
                    && (submission.getReviewedAt() == null || !artifact.getSubmittedAt().isAfter(submission.getReviewedAt()))) {
                return new ArtifactReviewState(submission.getStatus().name(), submission.getId());
            }
            String latestStatus = linkedVersion.map(v -> v.getStatus().name())
                    .orElseGet(() -> submission.getStatus().name());
            return new ArtifactReviewState(latestStatus, submission.getId());
        }

        // Historical (older) artifact version: never reviewable again
        if (linkedVersion.isPresent()) {
            SubmissionStatus vStatus = linkedVersion.get().getStatus();
            if (vStatus != SubmissionStatus.SUBMITTED && vStatus != SubmissionStatus.DRAFT) {
                return new ArtifactReviewState(vStatus.name(), null);
            }
        }
        var byVersionNum = versions.findBySubmissionIdAndVersionNumber(
                submission.getId(), (int) artifact.getVersion());
        if (byVersionNum.isPresent()) {
            SubmissionStatus vStatus = byVersionNum.get().getStatus();
            if (vStatus != SubmissionStatus.SUBMITTED && vStatus != SubmissionStatus.DRAFT) {
                return new ArtifactReviewState(vStatus.name(), null);
            }
        }
        return new ArtifactReviewState(SubmissionStatus.CHANGES_REQUESTED.name(), null);
    }

    /** Reads a persisted review result for one immutable artifact version without synchronizing or mutating it. */
    public String persistedStatusFor(MilestoneArtifactSubmission artifact) {
        return versions.findByArtifactSubmissionId(artifact.getId())
                .map(version -> version.getStatus().name())
                .orElse(artifact.getStatus().name());
    }

    public PersistedReview persistedReviewFor(MilestoneArtifactSubmission artifact) {
        return versions.findByArtifactSubmissionId(artifact.getId())
                .flatMap(version -> reviews.findBySubmissionVersionId(version.getId()))
                .map(review -> new PersistedReview(review.getOverallFeedback(), review.getReviewedAt()))
                .orElse(new PersistedReview(null, null));
    }

    public record PersistedReview(String feedback, java.time.Instant reviewedAt) { }

    private SubmissionVersion createVersion(MilestoneSubmission submission,
                                            MilestoneArtifactSubmission artifact,
                                            Milestone milestone,
                                            int number) {
        SubmissionVersion version = SubmissionVersion.draft(submission, number,
                versionTitle(milestone, artifact), artifact.getReleaseNotes(), primaryUrl(artifact),
                artifact.getSubmitterId(), artifact.getSubmittedAt());
        addArtifacts(version, artifact);
        snapshotChecklist(version, milestone);
        return version;
    }

    private List<SubmissionVersion.ArtifactValue> buildArtifactValues(MilestoneArtifactSubmission artifact) {
        List<SubmissionVersion.ArtifactValue> values = new ArrayList<>();
        if (artifact.getRepositoryUrl() != null) values.add(new SubmissionVersion.ArtifactValue(
                SubmissionArtifactType.REPOSITORY, "Source repository", artifact.getRepositoryUrl()));
        if (artifact.getDeploymentUrl() != null) values.add(new SubmissionVersion.ArtifactValue(
                SubmissionArtifactType.DEMO, "Deployment", artifact.getDeploymentUrl()));
        return values;
    }

    private void addArtifacts(SubmissionVersion version, MilestoneArtifactSubmission artifact) {
        version.replaceArtifacts(buildArtifactValues(artifact));
    }

    private void snapshotChecklist(SubmissionVersion version, Milestone milestone) {
        version.replaceChecklist(milestone.getChecklistItems().stream().map(item ->
                new SubmissionVersion.ChecklistValue(item.getId(), item.getContent(), item.isMandatory(),
                        false, null)).toList());
    }

    private User findByActorId(Long tenantId, UUID actorId) {
        return users.findByTenantIdAndIsActiveTrue(tenantId).stream()
                .filter(user -> actorId(user).equals(actorId)).findFirst().orElse(null);
    }

    private UUID actorId(User user) {
        return UUID.nameUUIDFromBytes(user.getEmail().getBytes(StandardCharsets.UTF_8));
    }

    private String versionTitle(Milestone milestone, MilestoneArtifactSubmission artifact) {
        return milestone.getTitle() + " · Artifact v" + artifact.getVersion();
    }

    private String primaryUrl(MilestoneArtifactSubmission artifact) {
        return artifact.getDeploymentUrl() != null ? artifact.getDeploymentUrl() : artifact.getRepositoryUrl();
    }
}
