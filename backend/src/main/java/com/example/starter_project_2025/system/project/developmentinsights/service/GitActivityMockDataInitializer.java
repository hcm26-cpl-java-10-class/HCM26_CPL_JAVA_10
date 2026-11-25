package com.example.starter_project_2025.system.project.developmentinsights.service;

import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommit;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitContributor;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitSyncStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequest;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestReviewState;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestState;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLink;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLinkSource;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitContributorRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.TaskGitLinkRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Seeds a clearly marked H2 demo repository when no source repository exists for a Workspace root. */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
@RequiredArgsConstructor
@ConditionalOnProperty(name = "app.git-activity.demo.enabled", havingValue = "true")
public class GitActivityMockDataInitializer implements ApplicationRunner {
    private final WorkspaceRepository workspaces;
    private final ProjectRepository projects;
    private final SprintBacklogRepository tasks;
    private final ProjectMemberRepository members;
    private final GitRepositoryRepository repositories;
    private final GitPullRequestRepository pullRequests;
    private final GitPullRequestReviewRepository reviews;
    private final GitContributorRepository contributors;
    private final GitCommitRepository commits;
    private final TaskGitLinkRepository links;
    private final UserRepository users;
    private final GitActivitySprintDemoData sprintDemo;
    private final GitActivityDemoExpansion demoExpansion;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        Map<Long, Workspace> workspaceByRootId = new LinkedHashMap<>();
        Map<Long, Project> rootById = new LinkedHashMap<>();
        for (Workspace workspace : workspaces.findAll()) {
            if (!Boolean.TRUE.equals(workspace.getIsActive()) || workspace.getStatus() != WorkspaceStatus.ACTIVE
                    || workspace.getProject() == null) continue;
            Project root = rootOf(workspace.getProject());
            Workspace selected = workspaceByRootId.get(root.getId());
            if (selected == null || (selected.getTeam() == null && workspace.getTeam() != null)) {
                workspaceByRootId.put(root.getId(), workspace);
                rootById.put(root.getId(), root);
            }
        }
        for (Map.Entry<Long, Workspace> entry : workspaceByRootId.entrySet()) {
            Project root = rootById.get(entry.getKey());
            seedForWorkspace(entry.getValue(), root);
            demoExpansion.seed(root, descendantProjectIds(root));
        }
    }

    void seedForWorkspace(Workspace workspace, Project root) {
        List<GitRepository> existing = repositories.findAllByRootProject_IdOrderByIdAsc(root.getId());
        boolean hasRealRepository = existing.stream().anyMatch(repository -> !repository.isMockData());
        if (hasRealRepository) return;

        GitRepository repository = existing.stream().filter(GitRepository::isMockData).findFirst().orElseGet(() -> {
            GitRepository created = new GitRepository();
            created.setRootProject(root);
            created.setExternalId(900_000_000_000_000L + root.getId());
            created.setOwner("hcm26-sample");
            created.setName("project-" + root.getId());
            created.setFullName(created.getOwner() + "/" + created.getName());
            created.setHtmlUrl(null);
            created.setDefaultBranch("main");
            created.setMockData(true);
            return created;
        });
        if (repository.getId() == null || repository.getStatus() == GitRepositoryStatus.INACTIVE) {
            repository.relink(Instant.now().minus(12, ChronoUnit.DAYS), "main");
            repository.setSyncStatus(GitSyncStatus.READY);
            repository.setLastSyncedAt(Instant.now().minus(2, ChronoUnit.MINUTES));
        }
        repository.setMockData(true);
        GitRepository seededRepository = repositories.saveAndFlush(repository);

        List<Long> projectIds = descendantProjectIds(root);
        List<SprintBacklog> taskRows = tasks.findAllByProjectIdInAndIsActiveTrueOrderByIdAsc(projectIds);
        List<SprintBacklog> fixtureTasks = new ArrayList<>(taskRows.stream()
                .collect(java.util.stream.Collectors.toMap(SprintBacklog::getProjectId, task -> task,
                        (first, ignored) -> first, java.util.LinkedHashMap::new))
                .values());
        if (fixtureTasks.size() < messages().length) {
            taskRows.stream().filter(task -> fixtureTasks.stream().noneMatch(selected -> selected.getId().equals(task.getId())))
                    .forEach(fixtureTasks::add);
        }

        Long mappedUserId = workspace.getTeam() == null ? null
                : members.findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(
                                workspace.getTeam().getId(), ClassMemberStatus.ACTIVE).stream()
                        .filter(member -> Boolean.TRUE.equals(member.getIsActive()))
                        .filter(member -> Boolean.TRUE.equals(member.getClassMember().getIsActive()))
                        .map(ProjectMember::getClassMember)
                        .map(classMember -> classMember.getUser())
                        .filter(user -> user != null)
                        .map(user -> user.getId())
                        .findFirst().orElse(null);
        GitContributor mapped = contributor(root, 71_000L + root.getId(), "dev-b", "Dev B", mappedUserId, false);
        GitContributor unmapped = contributor(root, 72_000L + root.getId(), "unmapped-contributor", "Unmapped Contributor", null, false);
        GitContributor bot = contributor(root, 73_000L + root.getId(), "dependabot", "dependabot[bot]", null, true);

        if (commits.countByRepository_Id(seededRepository.getId()) == 0) {
            AtomicInteger index = new AtomicInteger();
            for (String message : messages()) {
                int i = index.getAndIncrement();
                String sha = String.format("%040x", 0xabc000L + root.getId() * 10 + i);
                GitCommit commit = new GitCommit();
                commit.setRepository(seededRepository);
                commit.setSha(sha);
                commit.setMessage(message);
                commit.setAuthorContributor(i == 5 ? bot : i == 2 ? unmapped : mapped);
                commit.setCommittedAt(Instant.now().minus(i, ChronoUnit.DAYS));
                commit.setHtmlUrl(null);
                commit.setFirstSeenBranch(i == 0 ? "main" : "feature/demo-" + (i % 3));
                commit.setBot(i == 5);
                commit.setMergeCommit(i == 4);
                commit = commits.saveAndFlush(commit);
                if (i < fixtureTasks.size()) {
                    TaskGitLink link = new TaskGitLink();
                    link.setTask(fixtureTasks.get(i));
                    link.setCommit(commit);
                    link.setSource(TaskGitLinkSource.AUTO);
                    link.setLinkedAt(commit.getCommittedAt());
                    links.save(link);
                }
            }
        }

        Instant mergedCreatedAt = Instant.now().minus(9, ChronoUnit.DAYS);
        Instant mergedUpdatedAt = Instant.now().minus(6, ChronoUnit.DAYS);
        GitPullRequest merged = pullRequests.findFirstByRepository_IdAndExternalId(seededRepository.getId(),
                91_000L + root.getId()).orElseGet(() -> pullRequest(seededRepository, mapped, 11, 91_000L + root.getId(),
                "feat: add Git Activity", "Add paged commit history and linked Task view.",
                GitPullRequestState.MERGED, "feature/git-activity", "main", mergedCreatedAt,
                mergedUpdatedAt, mergedUpdatedAt, mergedUpdatedAt));
        reviews.findFirstByPullRequest_IdAndExternalId(merged.getId(), 92_000L + root.getId())
                .orElseGet(() -> {
                    GitPullRequestReview review = new GitPullRequestReview();
                    review.setPullRequest(merged);
                    review.setExternalId(92_000L + root.getId());
                    review.setReviewerContributor(unmapped);
                    review.setState(GitPullRequestReviewState.APPROVED);
                    review.setSubmittedAt(Instant.now().minus(7, ChronoUnit.DAYS));
                    review.setSourceUpdatedAt(review.getSubmittedAt());
                    review.setSelfReview(false);
                    return reviews.saveAndFlush(review);
                });

        pullRequests.findFirstByRepository_IdAndExternalId(seededRepository.getId(), 93_000L + root.getId())
                .orElseGet(() -> pullRequest(seededRepository, mapped, 12, 93_000L + root.getId(),
                "fix: preserve Workspace access", "Keep module visibility aligned with the current assignment.",
                GitPullRequestState.OPEN, "fix/workspace-scope", "main", Instant.now().minus(2, ChronoUnit.DAYS),
                Instant.now().minus(1, ChronoUnit.DAYS), null, null));
        if (!fixtureTasks.isEmpty() && !links.existsByTask_IdAndPullRequest_Id(fixtureTasks.get(0).getId(), merged.getId())) {
            TaskGitLink prLink = new TaskGitLink();
            prLink.setTask(fixtureTasks.get(0));
            prLink.setPullRequest(merged);
            prLink.setSource(TaskGitLinkSource.AUTO);
            prLink.setLinkedAt(merged.getCreatedAt());
            links.save(prLink);
        }
        sprintDemo.seed(workspace, seededRepository);
    }

    private GitContributor contributor(Project root, Long externalId, String login,
                                       String displayName, Long userId, boolean bot) {
        GitContributor existing = contributors.findFirstByRootProject_IdAndExternalId(root.getId(), externalId)
                .orElse(null);
        if (existing != null) return existing;
        GitContributor contributor = new GitContributor();
        contributor.setRootProject(root);
        contributor.setExternalId(externalId);
        contributor.setLogin(login);
        contributor.setDisplayName(displayName);
        contributor.setUser(userId == null ? null : users.findById(userId).orElse(null));
        contributor.setBot(bot);
        return contributors.saveAndFlush(contributor);
    }

    private GitPullRequest pullRequest(GitRepository repository, GitContributor author, int number,
                                       Long externalId, String title, String body, GitPullRequestState state,
                                       String source, String target, Instant createdAt, Instant updatedAt,
                                       Instant mergedAt, Instant closedAt) {
        GitPullRequest pullRequest = new GitPullRequest();
        pullRequest.setRepository(repository);
        pullRequest.setNumber(number);
        pullRequest.setExternalId(externalId);
        pullRequest.setTitle(title);
        pullRequest.setBody(body);
        pullRequest.setAuthorContributor(author);
        pullRequest.setState(state);
        pullRequest.setDraft(false);
        pullRequest.setSourceBranch(source);
        pullRequest.setTargetBranch(target);
        pullRequest.setHtmlUrl(null);
        pullRequest.setCreatedAt(createdAt);
        pullRequest.setSourceUpdatedAt(updatedAt);
        pullRequest.setMergedAt(mergedAt);
        pullRequest.setClosedAt(closedAt);
        pullRequest.setFirstReviewAt(state == GitPullRequestState.MERGED ? Instant.now().minus(7, ChronoUnit.DAYS) : null);
        return pullRequests.saveAndFlush(pullRequest);
    }

    private Project rootOf(Project project) {
        Project current = project;
        Set<Long> seen = new HashSet<>();
        while (true) {
            if (!seen.add(current.getId())) throw new IllegalStateException("Project hierarchy contains a cycle");
            if (current.getParentProject() == null) return current;
            current = current.getParentProject();
        }
    }

    private List<Long> descendantProjectIds(Project root) {
        java.util.LinkedHashSet<Long> ids = new java.util.LinkedHashSet<>();
        java.util.ArrayDeque<Project> pending = new java.util.ArrayDeque<>();
        pending.add(root);
        while (!pending.isEmpty()) {
            Project parent = pending.removeFirst();
            if (!ids.add(parent.getId())) continue;
            projects.findAllByParentProject_IdAndIsActiveTrueOrderByIdAsc(parent.getId()).forEach(pending::addLast);
        }
        return ids.stream().toList();
    }

    private String[] messages() {
        return new String[]{
                "feat(workspace): show commit history",
                "fix(backlog): keep task status transition",
                "docs(project): refresh setup notes",
                "feat(api): add paged activity query",
                "test(project): cover repository scope",
                "chore(deps): update demo dependency"
        };
    }
}
