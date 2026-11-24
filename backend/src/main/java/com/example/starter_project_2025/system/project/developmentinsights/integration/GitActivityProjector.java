package com.example.starter_project_2025.system.project.developmentinsights.integration;

import com.example.starter_project_2025.system.git_integration.contributor.ContributorDirectory;
import com.example.starter_project_2025.system.git_integration.contributor.ContributorSightings;
import com.example.starter_project_2025.system.git_integration.contributor.GitContributorRegistry;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.project.developmentinsights.domain.*;
import com.example.starter_project_2025.system.project.developmentinsights.repository.*;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitCommitValidationService;
import com.example.starter_project_2025.system.project.domain.Project;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * A owns the Git source. B's existing tables form a rebuildable read model, preserving
 * its API/fixture IDs. Every refresh reads current source rows; stale deliveries cannot
 * revert a newer source state. The worker commits the read model, rule results and receipt together.
 */
@Component
@RequiredArgsConstructor
public class GitActivityProjector {
    private final com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository sourceRepositories;
    private final com.example.starter_project_2025.system.git_integration.repository.GitCommitRepository sourceCommits;
    private final com.example.starter_project_2025.system.git_integration.repository.GitPullRequestRepository sourcePullRequests;
    private final com.example.starter_project_2025.system.git_integration.repository.GitPullRequestReviewRepository sourceReviews;
    private final com.example.starter_project_2025.system.git_integration.repository.GitContributorRepository sourceContributors;
    private final com.example.starter_project_2025.system.git_integration.repository.BacklogGitLinkRepository sourceLinks;
    private final com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository jobs;
    private final GitContributorRegistry registry;
    private final GitRepositoryRepository repositories;
    private final GitContributorRepository contributors;
    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final GitPullRequestReviewRepository reviews;
    private final TaskGitLinkRepository links;
    private final GitCommitValidationService validation;

    @Transactional(propagation = Propagation.MANDATORY)
    public void refresh(Long sourceId) {
        var source = sourceRepositories.findById(sourceId).orElse(null);
        if (source == null) return;
        Project root = source.getProject();
        if (root == null || !Objects.equals(root.getTenantId(), source.getTenantId())) {
            throw new IllegalStateException("Git repository Project tenant does not match");
        }
        GitRepository repository = repository(source);
        var sourceCommitRows = sourceCommits.findByRepository_IdOrderByIdAsc(sourceId);
        var sourcePrRows = sourcePullRequests.findByRepository_IdOrderByIdAsc(sourceId);
        var sourceReviewRows = sourcePrRows.isEmpty() ? List.<com.example.starter_project_2025.system.git_integration.domain.GitPullRequestReview>of()
                : sourceReviews.findByPullRequest_IdIn(sourcePrRows.stream().map(pr -> pr.getId()).toList());
        // Repairs sightings missing after an old contributor AFTER_COMMIT listener failed.
        var sightings = new ContributorSightings();
        sourceCommitRows.forEach(c -> sightings.add(c.getAuthorGithubId(), c.getAuthorEmail(), c.getAuthorLogin(), c.getAuthorName(), c.getCommittedAt()));
        sourcePrRows.forEach(pr -> sightings.add(pr.getAuthorGithubId(), null, pr.getAuthorLogin(), null, pr.getGithubCreatedAt()));
        sourceReviewRows.forEach(r -> sightings.add(r.getReviewerGithubId(), null, r.getReviewerLogin(), null,
                r.getSubmittedAt() == null ? r.getSourceUpdatedAt() : r.getSubmittedAt()));
        registry.record(source.getTenantId(), root.getId(), sightings);
        var directory = new ContributorDirectory(sourceContributors.findByMasterProject_IdOrderByIdAsc(root.getId()));
        Map<Long, GitCommit> commitMap = new LinkedHashMap<>();
        List<GitCommit> newCommits = new ArrayList<>();
        for (var row : sourceCommitRows) {
            GitCommit commit = commits.findFirstByRepository_IdAndSha(repository.getId(), row.getSha()).orElseGet(GitCommit::new);
            boolean newlyProjected = commit.getId() == null;
            commit.setRepository(repository);
            commit.setSha(row.getSha());
            commit.setMessage(Objects.toString(row.getMessage(), ""));
            commit.setAuthorContributor(contributor(root, directory, row.getAuthorGithubId(), row.getAuthorLogin(),
                    row.getAuthorEmail(), row.getAuthorName(), "commit:" + row.getId()));
            commit.setCommittedAt(instant(row.getCommittedAt()));
            commit.setSourceIngestedAt(instant(row.getIngestedAt()));
            commit.setFirstSeenBranch(branch(row.getFirstSeenRef()));
            commit.setHtmlUrl(row.getHtmlUrl());
            commit.setBot(Boolean.TRUE.equals(row.getBot()));
            commit.setMergeCommit(Boolean.TRUE.equals(row.getMergeCommit()));
            commitMap.put(row.getId(), commits.saveAndFlush(commit));
            if (newlyProjected) newCommits.add(commit);
        }
        Map<Long, GitPullRequest> prMap = new LinkedHashMap<>();
        for (var row : sourcePrRows) {
            GitPullRequest pr = pullRequests.findFirstByRepository_IdAndExternalId(repository.getId(), row.getExternalId()).orElseGet(GitPullRequest::new);
            pr.setRepository(repository);
            pr.setNumber(row.getNumber());
            pr.setExternalId(row.getExternalId());
            pr.setTitle(row.getTitle());
            pr.setBody(row.getBody());
            pr.setAuthorContributor(contributor(root, directory, row.getAuthorGithubId(), row.getAuthorLogin(), null, null, "pr:" + row.getId()));
            pr.setState(GitPullRequestState.valueOf(row.getState().name()));
            pr.setDraft(Boolean.TRUE.equals(row.getDraft()));
            pr.setSourceBranch(Objects.toString(row.getHeadRef(), ""));
            pr.setTargetBranch(Objects.toString(row.getBaseRef(), ""));
            pr.setHtmlUrl(row.getHtmlUrl());
            pr.setCreatedAt(instant(row.getGithubCreatedAt()));
            pr.setSourceUpdatedAt(instant(row.getGithubUpdatedAt()));
            pr.setMergedAt(instant(row.getMergedAt()));
            pr.setClosedAt(instant(row.getClosedAt()));
            prMap.put(row.getId(), pullRequests.saveAndFlush(pr));
        }
        Map<Long, List<GitPullRequestReview>> reviewsByPr = new HashMap<>();
        for (var row : sourceReviewRows) {
            GitPullRequest pr = prMap.get(row.getPullRequestId());
            if (pr == null) continue;
            GitPullRequestReview review = reviews.findFirstByPullRequest_IdAndExternalId(pr.getId(), row.getExternalId()).orElseGet(GitPullRequestReview::new);
            review.setPullRequest(pr);
            review.setExternalId(row.getExternalId());
            review.setReviewerContributor(contributor(root, directory, row.getReviewerGithubId(), row.getReviewerLogin(), null, null, "review:" + row.getId()));
            review.setState(GitPullRequestReviewState.valueOf(row.getState().name()));
            review.setSubmittedAt(instant(row.getSubmittedAt()));
            review.setSourceUpdatedAt(instant(row.getSourceUpdatedAt()));
            var author = row.getPullRequest();
            review.setSelfReview(row.getReviewerGithubId() != null && row.getReviewerGithubId().equals(author.getAuthorGithubId())
                    || row.getReviewerGithubId() == null && row.getReviewerLogin() != null && row.getReviewerLogin().equalsIgnoreCase(author.getAuthorLogin()));
            review = reviews.saveAndFlush(review);
            reviewsByPr.computeIfAbsent(pr.getId(), ignored -> new ArrayList<>()).add(review);
        }
        prMap.values().forEach(pr -> pr.setFirstReviewAt(reviewsByPr.getOrDefault(pr.getId(), List.of()).stream()
                .filter(r -> !r.isSelfReview() && r.getState() != GitPullRequestReviewState.PENDING && r.getState() != GitPullRequestReviewState.DISMISSED)
                .map(GitPullRequestReview::getSubmittedAt).filter(Objects::nonNull)
                .filter(at -> pr.getCreatedAt() != null && !at.isBefore(pr.getCreatedAt())).min(Instant::compareTo).orElse(null)));
        reconcileLinks(sourceId, root, commitMap, prMap);
        newCommits.forEach(validation::validateSyncedCommit);
    }

    private GitRepository repository(com.example.starter_project_2025.system.git_integration.domain.GitRepository source) {
        Project root = source.getProject();
        GitRepository repository = repositories.findBySourceRepository_Id(source.getId())
                .orElseGet(() -> repositories.findFirstByRootProject_IdAndExternalId(root.getId(), source.getExternalId()).orElseGet(GitRepository::new));
        if (source.getStatus().holdsProject()) {
            repositories.findAllByRootProject_IdOrderByIdAsc(root.getId()).stream()
                    .filter(other -> !Objects.equals(other.getId(), repository.getId()))
                    .forEach(other -> other.markInactive(instant(source.getLinkedAt())));
            repositories.flush();
        }
        repository.setRootProject(root);
        repository.setSourceRepository(source);
        repository.setExternalId(source.getExternalId());
        repository.setOwner(source.getOwnerLogin());
        repository.setName(source.getName());
        repository.setFullName(source.getFullName());
        repository.setHtmlUrl(source.getHtmlUrl());
        repository.setDefaultBranch(source.getDefaultBranch());
        repository.setStatus(GitRepositoryStatus.valueOf(source.getStatus().name()));
        repository.setMockData(false);
        repository.setLinkedAt(instant(source.getLinkedAt()));
        repository.setUnlinkedAt(instant(source.getUnlinkedAt()));
        repository.setLastSyncedAt(instant(source.getLastSyncedAt()));
        repository.setSyncStatus(jobs.findFirstByRepository_IdOrderByIdDesc(source.getId()).map(job -> switch (job.getStatus()) {
            case PENDING, RUNNING -> GitSyncStatus.SYNCING;
            case SUCCEEDED -> GitSyncStatus.READY;
            case PARTIAL -> GitSyncStatus.PARTIAL;
            case FAILED -> GitSyncStatus.ERROR;
        }).orElse(source.getLastSyncedAt() == null ? GitSyncStatus.NOT_SYNCED : GitSyncStatus.READY));
        return repositories.saveAndFlush(repository);
    }

    private GitContributor contributor(Project root, ContributorDirectory directory, Long githubId, String login,
                                        String email, String name, String fallback) {
        var source = directory.resolve(githubId, login, email);
        String key = source != null ? source.getIdentityKey() : githubId != null ? "gh:" + githubId
                : login != null ? "login:" + login.toLowerCase(Locale.ROOT) : "unknown:" + fallback;
        Long externalId = source == null ? githubId : source.getExternalUserId();
        GitContributor contributor = contributors.findFirstByRootProject_IdAndSourceIdentityKey(root.getId(), key)
                .orElseGet(() -> externalId == null ? new GitContributor()
                        : contributors.findFirstByRootProject_IdAndExternalId(root.getId(), externalId).orElseGet(GitContributor::new));
        contributor.setRootProject(root);
        contributor.setSourceIdentityKey(key);
        contributor.setSourceContributor(source);
        contributor.setExternalId(externalId);
        String label = source != null && source.getLogin() != null ? source.getLogin()
                : login != null ? login : email != null ? email : "Unknown contributor";
        contributor.setLogin(label.substring(0, Math.min(label.length(), 100)));
        contributor.setDisplayName(source != null && source.getDisplayName() != null ? source.getDisplayName() : name);
        contributor.setUser(source == null ? null : source.getUser());
        contributor.setBot(contributor.getLogin().toLowerCase(Locale.ROOT).endsWith("[bot]"));
        return contributors.saveAndFlush(contributor);
    }

    private void reconcileLinks(Long repositoryId, Project root, Map<Long, GitCommit> commitMap, Map<Long, GitPullRequest> prMap) {
        Map<String, TaskGitLink> remaining = new HashMap<>();
        if (!commitMap.isEmpty()) links.findAllByCommit_IdIn(commitMap.values().stream().map(GitCommit::getId).toList())
                .forEach(link -> remaining.put("COMMIT:" + link.getCommit().getId() + ":" + link.getTask().getId(), link));
        if (!prMap.isEmpty()) links.findAllByPullRequest_IdIn(prMap.values().stream().map(GitPullRequest::getId).toList())
                .forEach(link -> remaining.put("PULL_REQUEST:" + link.getPullRequest().getId() + ":" + link.getTask().getId(), link));
        for (var source : sourceLinks.findByRepository_IdOrderByIdAsc(repositoryId)) {
            var task = source.getBacklogItem();
            if (task == null || !Boolean.TRUE.equals(task.getIsActive())) continue;
            Project taskProject = source.getItemProject();
            if (taskProject == null || !Objects.equals(taskProject.getTenantId(), root.getTenantId())
                    || !Objects.equals(rootOf(taskProject), root.getId())) continue;
            GitCommit commit = source.getArtifactType() == GitArtifactType.COMMIT ? commitMap.get(source.getArtifactId()) : null;
            GitPullRequest pr = source.getArtifactType() == GitArtifactType.PULL_REQUEST ? prMap.get(source.getArtifactId()) : null;
            if (commit == null && pr == null) continue;
            String key = source.getArtifactType() + ":" + (commit != null ? commit.getId() : pr.getId()) + ":" + task.getId();
            TaskGitLink link = remaining.remove(key);
            if (link == null) link = new TaskGitLink();
            link.setTask(task);
            link.setCommit(commit);
            link.setPullRequest(pr);
            link.setSource(TaskGitLinkSource.valueOf(source.getLinkSource().name()));
            link.setLinkedAt(instant(source.getLinkedAt()));
            link.setLinkedBy(source.getLinkedByUser());
            links.save(link);
        }
        links.deleteAll(remaining.values());
        links.flush();
    }

    private static Long rootOf(Project project) {
        Set<Long> seen = new HashSet<>();
        while (project != null && seen.add(project.getId())) {
            if (project.getParentProject() == null) return project.getId();
            project = project.getParentProject();
        }
        return null;
    }
    private static Instant instant(LocalDateTime value) {
        return value == null ? null : value.atZone(java.time.ZoneId.systemDefault()).toInstant();
    }
    private static String branch(String ref) { return ref != null && ref.startsWith("refs/heads/") ? ref.substring(11) : ref; }
}
