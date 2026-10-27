package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.submission.domain.*;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneSubmissionRepository;
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
    private final ProjectTeamRepository teams;
    private final UserRepository users;
    private final SubmissionQueryService submissionQueryService;

    public UUID synchronize(Milestone milestone, MilestoneArtifactSubmission artifact) {
        var alreadyLinked = versions.findByArtifactSubmissionId(artifact.getId());
        if (alreadyLinked.isPresent()) return alreadyLinked.get().getSubmission().getId();
        if (milestone.getProjectId() == null || artifact.getTeamId() == null) return null;

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
        } else {
            version = versions.findBySubmissionIdAndVersionNumber(submission.getId(), submission.getCurrentVersionNumber())
                    .orElse(null);
            if (version == null || version.getArtifactSubmissionId() != null) return null;
            version.linkArtifactSubmission(artifact.getId());
            versions.save(version);
            return submission.getId();
        }

        version.linkArtifactSubmission(artifact.getId());
        version.submit(artifact.getSubmittedAt(), artifact.isSubmittedLate(), artifact.getLatePenaltyPercent());
        submission.submitted(version.getVersionNumber(), artifact.getSubmittedAt());
        versions.save(version);
        submissions.saveAndFlush(submission);
        return submission.getId();
    }

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

    private void addArtifacts(SubmissionVersion version, MilestoneArtifactSubmission artifact) {
        List<SubmissionVersion.ArtifactValue> values = new ArrayList<>();
        if (artifact.getRepositoryUrl() != null) values.add(new SubmissionVersion.ArtifactValue(
                SubmissionArtifactType.REPOSITORY, "Source repository", artifact.getRepositoryUrl()));
        if (artifact.getDeploymentUrl() != null) values.add(new SubmissionVersion.ArtifactValue(
                SubmissionArtifactType.DEMO, "Deployment", artifact.getDeploymentUrl()));
        version.replaceArtifacts(values);
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
