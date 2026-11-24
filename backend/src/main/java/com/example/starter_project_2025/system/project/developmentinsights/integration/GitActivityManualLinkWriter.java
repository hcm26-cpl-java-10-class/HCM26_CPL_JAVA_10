package com.example.starter_project_2025.system.project.developmentinsights.integration;

import com.example.starter_project_2025.system.git_integration.domain.*;
import com.example.starter_project_2025.system.git_integration.ingestion.event.GitSourceChangedEvent;
import com.example.starter_project_2025.system.git_integration.repository.BacklogGitLinkRepository;
import com.example.starter_project_2025.system.git_integration.repository.BacklogGitLinkExclusionRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.rbac.user.User;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Authorized Workspace actions write A's canonical link so AUTO retries preserve MANUAL. */
@Service
@RequiredArgsConstructor
public class GitActivityManualLinkWriter {
    private final BacklogGitLinkRepository links;
    private final BacklogGitLinkExclusionRepository exclusions;
    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final ProjectRepository projects;
    private final ApplicationEventPublisher events;
    private final GitActivityProjector projector;

    @Transactional(propagation = Propagation.MANDATORY)
    public void link(com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepository activityRepository,
                     String sha, Long pullRequestExternalId, SprintBacklog task, User actor) {
        GitRepository repository = activityRepository.getSourceRepository();
        GitArtifactType type = sha != null ? GitArtifactType.COMMIT : GitArtifactType.PULL_REQUEST;
        GitArtifact artifact;
        LocalDateTime occurredAt;
        if (type == GitArtifactType.COMMIT) {
            GitCommit commit = commits.findFirstByRepository_IdAndSha(repository.getId(), sha).orElseThrow();
            // Same lock used by automatic commit mapping.
            commit = commits.lockById(commit.getId()).orElseThrow();
            artifact = commit;
            occurredAt = commit.getCommittedAt();
        } else {
            GitPullRequest pr = pullRequests.findByRepository_IdAndExternalId(repository.getId(), pullRequestExternalId).orElseThrow();
            pr = pullRequests.lockById(pr.getId()).orElseThrow();
            artifact = pr;
            occurredAt = pr.getGithubCreatedAt();
        }
        BacklogGitLink link = links.findByBacklogItem_IdAndArtifactTypeAndArtifact_Id(task.getId(), type, artifact.getId())
                .orElseGet(() -> BacklogGitLink.builder().tenant(repository.getTenant()).project(repository.getProject())
                        .repository(repository).backlogItem(task).itemProject(projects.getReferenceById(task.getProjectId()))
                        .artifactType(type).artifact(artifact).artifactAt(occurredAt).build());
        link.confirmManual(actor, LocalDateTime.now());
        exclusions.deletePair(task.getId(), type, artifact.getId());
        links.saveAndFlush(link);
        events.publishEvent(new GitSourceChangedEvent(repository.getId()));
        projector.refresh(repository.getId());
    }
}
