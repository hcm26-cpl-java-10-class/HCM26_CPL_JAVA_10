package com.example.starter_project_2025.system.project.developmentinsights.service;

import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommit;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationResult;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommitValidationStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRule;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitDevelopmentRuleType;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequest;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLink;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLinkSource;
import com.example.starter_project_2025.system.project.developmentinsights.dto.GitUnmappedActivityDtos;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitValidationResultRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitDevelopmentRuleRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.TaskGitLinkRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceRosterService;
import com.example.starter_project_2025.system.rbac.user.User;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Workspace-scoped view and manager actions for Git activities without a Task link. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GitUnmappedActivityService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");

    private final GitActivityScopeService scopes;
    private final GitRepositoryRepository repositories;
    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final TaskGitLinkRepository links;
    private final GitCommitValidationResultRepository validations;
    private final GitDevelopmentRuleRepository rules;
    private final GitTaskReferenceResolver taskReferences;
    private final SprintBacklogRepository tasks;
    private final ProjectRepository projects;
    private final WorkspaceAccessService access;
    private final WorkspaceRosterService roster;

    public GitUnmappedActivityDtos.UnmappedPage list(Long workspaceId,
                                                     GitUnmappedActivityDtos.ActivityType type,
                                                     LocalDate from, LocalDate to,
                                                     String search, int page, int size) {
        validatePage(from, to, page, size);
        GitActivityScope scope = scopes.require(workspaceId);
        if (type == null) type = GitUnmappedActivityDtos.ActivityType.ALL;
        Instant fromTime = from == null ? null : from.atStartOfDay(BUSINESS_ZONE).toInstant();
        Instant untilTime = to == null ? null : to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant();
        String query = search == null || search.isBlank() ? null : search.trim().toLowerCase(Locale.ROOT);

        List<GitRepository> sourceRepositories = repositories.findAllByRootProject_IdOrderByIdAsc(scope.rootProjectId());
        boolean hasRealRepository = sourceRepositories.stream().anyMatch(repository -> !repository.isMockData());
        List<GitRepository> selectedRepositories = sourceRepositories.stream()
                .filter(repository -> !repository.isMockData() || !hasRealRepository).toList();
        Set<Long> repositoryIds = selectedRepositories.stream().map(GitRepository::getId)
                .filter(Objects::nonNull).collect(java.util.stream.Collectors.toSet());

        List<GitCommit> sourceCommits = repositoryIds.isEmpty() ? List.of()
                : commits.findAllByRepository_IdInOrderByCommittedAtAscIdAsc(repositoryIds);
        List<GitPullRequest> sourcePullRequests = selectedRepositories.stream()
                .flatMap(repository -> pullRequests.findAllByRepository_IdOrderByCreatedAtAscIdAsc(repository.getId()).stream())
                .toList();

        Set<Long> commitIds = sourceCommits.stream().map(GitCommit::getId).filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        Set<Long> pullRequestIds = sourcePullRequests.stream().map(GitPullRequest::getId).filter(Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        Set<Long> linkedCommitIds = commitIds.isEmpty() ? Set.of() : links.findAllByCommit_IdIn(commitIds).stream()
                .map(TaskGitLink::getCommit).filter(Objects::nonNull).map(GitCommit::getId)
                .collect(java.util.stream.Collectors.toSet());
        Set<Long> linkedPullRequestIds = pullRequestIds.isEmpty() ? Set.of()
                : links.findAllByPullRequest_IdIn(pullRequestIds).stream()
                .map(TaskGitLink::getPullRequest).filter(Objects::nonNull).map(GitPullRequest::getId)
                .collect(java.util.stream.Collectors.toSet());

        String taskPattern = taskPattern(scope);
        List<GitUnmappedActivityDtos.Item> visible = new ArrayList<>();
        if (type == GitUnmappedActivityDtos.ActivityType.ALL || type == GitUnmappedActivityDtos.ActivityType.COMMIT) {
            sourceCommits.stream().filter(commit -> !linkedCommitIds.contains(commit.getId()))
                    .filter(commit -> isVisible(scope, commit.getAuthorContributor() == null ? null
                            : commit.getAuthorContributor().getId()))
                    .filter(commit -> isWithin(commit.getCommittedAt(), fromTime, untilTime))
                    .filter(commit -> query == null || contains(commit.getMessage(), query)
                            || contains(commit.getSha(), query)
                            || commit.getAuthorContributor() != null
                            && contains(commit.getAuthorContributor().label(), query))
                    .map(commit -> new GitUnmappedActivityDtos.Item(
                            GitUnmappedActivityDtos.ActivityType.COMMIT, commit.getId(), null, commit.getSha(),
                            commit.getMessage() == null ? "(no message)" : commit.getMessage().lines().findFirst().orElse("(no message)"),
                            commit.getAuthorContributor() == null ? "Unknown contributor" : commit.getAuthorContributor().label(),
                            commit.getAuthorContributor() == null ? null : commit.getAuthorContributor().getLogin(),
                            null, commitReason(scope.rootProjectId(), commit, taskPattern),
                            commit.getCommittedAt(), commit.getHtmlUrl()))
                    .forEach(visible::add);
        }
        if (type == GitUnmappedActivityDtos.ActivityType.ALL || type == GitUnmappedActivityDtos.ActivityType.PULL_REQUEST) {
            sourcePullRequests.stream().filter(request -> !linkedPullRequestIds.contains(request.getId()))
                    .filter(request -> isVisible(scope, request.getAuthorContributor() == null ? null
                            : request.getAuthorContributor().getId()))
                    .filter(request -> isWithin(request.getCreatedAt(), fromTime, untilTime))
                    .filter(request -> query == null || contains(request.getTitle(), query)
                            || contains(request.getBody(), query)
                            || request.getAuthorContributor() != null
                            && contains(request.getAuthorContributor().label(), query))
                    .map(request -> new GitUnmappedActivityDtos.Item(
                            GitUnmappedActivityDtos.ActivityType.PULL_REQUEST, request.getId(), request.getNumber(), null,
                            request.getTitle(), request.getAuthorContributor() == null
                            ? "Unknown contributor" : request.getAuthorContributor().label(),
                            request.getAuthorContributor() == null ? null : request.getAuthorContributor().getLogin(),
                            request.getState() == null ? null : request.getState().name(),
                            referenceReason(taskReferences.resolve(scope.rootProjectId(),
                                    request.getTitle() + "\n" + Objects.toString(request.getBody(), ""), taskPattern).status()),
                            request.getCreatedAt(), request.getHtmlUrl()))
                    .forEach(visible::add);
        }

        visible.sort(Comparator.comparing(GitUnmappedActivityDtos.Item::occurredAt,
                        Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(GitUnmappedActivityDtos.Item::type)
                .thenComparing(GitUnmappedActivityDtos.Item::id, Comparator.reverseOrder()));
        int start = Math.min(page * size, visible.size());
        int end = Math.min(start + size, visible.size());
        return new GitUnmappedActivityDtos.UnmappedPage(
                new PageImpl<>(visible.subList(start, end), PageRequest.of(page, size), visible.size()),
                canManage(scope, access.requireUser(false)));
    }

    public GitUnmappedActivityDtos.TaskOptions taskOptions(Long workspaceId, Long projectId, String search) {
        GitActivityScope scope = scopes.require(workspaceId);
        if (!scope.canReadTasks()) throw new AccessDeniedException("Task read permission is required");
        if (projectId != null && !scope.projectIds().contains(projectId)) {
            throw new AccessDeniedException("The selected Project is outside the current Workspace scope");
        }
        List<Long> allowed = projectId == null ? scope.projectList() : List.of(projectId);
        String query = search == null || search.isBlank() ? null : search.trim().toLowerCase(Locale.ROOT);
        List<GitUnmappedActivityDtos.TaskOption> options = tasks
                .findAllByProjectIdInAndIsActiveTrueOrderByIdAsc(allowed).stream()
                .filter(task -> task.getProjectId() != null && scope.projectIds().contains(task.getProjectId()))
                .filter(task -> query == null || contains(task.getTitle(), query))
                .limit(200)
                .map(task -> {
                    var project = projects.findById(task.getProjectId()).orElse(null);
                    return new GitUnmappedActivityDtos.TaskOption(task.getId(), task.getProjectId(),
                            project == null ? null : project.getName(), task.getTitle());
                }).toList();
        return new GitUnmappedActivityDtos.TaskOptions(options);
    }

    @Transactional
    public GitUnmappedActivityDtos.LinkResult link(Long workspaceId, GitUnmappedActivityDtos.LinkInput input) {
        if (input == null || input.type() == null || input.activityId() == null || input.taskId() == null
                || input.type() == GitUnmappedActivityDtos.ActivityType.ALL) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a commit or pull request and a Task.");
        }
        GitActivityScope scope = scopes.require(workspaceId);
        User actor = access.requireUser(false);
        requireManager(scope, actor);
        if (!scope.canReadTasks()) throw new AccessDeniedException("Task read permission is required");
        SprintBacklog task = tasks.findById(input.taskId())
                .filter(item -> Boolean.TRUE.equals(item.getIsActive()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task was not found"));
        Long projectId = task.getProjectId() != null ? task.getProjectId()
                : task.getSprint() == null ? null : task.getSprint().getProjectId();
        if (projectId == null || !scope.projectIds().contains(projectId)) {
            throw new AccessDeniedException("Task is outside the current Workspace Project scope");
        }
        GitCommit commit = null;
        GitPullRequest pullRequest = null;
        if (input.type() == GitUnmappedActivityDtos.ActivityType.COMMIT) {
            commit = commits.findInRoot(scope.rootProjectId(), input.activityId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commit was not found"));
            if (!isVisible(scope, commit.getAuthorContributor() == null ? null : commit.getAuthorContributor().getId())) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Commit was not found in this Workspace scope");
            }
            if (!links.findAllByCommit_IdOrderByTask_IdAsc(commit.getId()).isEmpty()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This activity already has a Task link");
            }
        } else {
            pullRequest = pullRequests.findInRoot(scope.rootProjectId(), input.activityId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pull request was not found"));
            if (!isVisible(scope, pullRequest.getAuthorContributor() == null ? null
                    : pullRequest.getAuthorContributor().getId())) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Pull request was not found in this Workspace scope");
            }
            if (!links.findAllByPullRequest_IdOrderByTask_IdAsc(pullRequest.getId()).isEmpty()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "This activity already has a Task link");
            }
        }
        TaskGitLink link = new TaskGitLink();
        link.setTask(task);
        link.setCommit(commit);
        link.setPullRequest(pullRequest);
        link.confirmManual(actor, Instant.now());
        TaskGitLink saved = links.saveAndFlush(link);
        return linkResult(saved, input.type(), input.activityId(), projectId, actor);
    }

    private String commitReason(Long rootId, GitCommit commit, String pattern) {
        GitCommitValidationResult result = validations.findAllByCommit_IdOrderByEvaluatedAtDescIdDesc(commit.getId())
                .stream().filter(value -> value.getType() == GitDevelopmentRuleType.TASK_ID).findFirst().orElse(null);
        return result == null ? referenceReason(taskReferences.resolve(rootId, commit.getMessage(), pattern).status())
                : referenceReason(result.getStatus());
    }

    private String taskPattern(GitActivityScope scope) {
        return rules.findAllByRootProject_IdOrderByTypeAscVersionDesc(scope.rootProjectId()).stream()
                .filter(rule -> rule.getType() == GitDevelopmentRuleType.TASK_ID).findFirst()
                .map(GitDevelopmentRule::getTaskKeyPattern)
                .orElseGet(() -> "(?i)\\b" + java.util.regex.Pattern.quote(
                        scope.workspace().getTaskKeyPrefix() == null || scope.workspace().getTaskKeyPrefix().isBlank()
                                ? "FA" : scope.workspace().getTaskKeyPrefix().trim()) + "-\\d+\\b");
    }

    private String referenceReason(GitCommitValidationStatus status) {
        if (status == null) return "Task mapping has not been processed.";
        return switch (status) {
            case MISSING -> "No Task ID was found in the activity.";
            case INVALID -> "Task ID does not exist or is inactive.";
            case OUTSIDE_PROJECT -> "Task belongs to another Project.";
            case PASSED -> "Task ID is valid, but the activity link is still pending.";
            case FAILED -> "Task validation failed.";
            case NOT_EVALUATED -> "Task validation has not been run.";
        };
    }

    private boolean isVisible(GitActivityScope scope, Long contributorId) {
        return scope.rootScope() || contributorId != null && scope.contributorIds().contains(contributorId);
    }

    private boolean canManage(GitActivityScope scope, User actor) {
        if (actor == null) return false;
        if (actor.getRoles() != null && actor.getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                && ("ADMIN".equals(role.getName()) || "SUPER_ADMIN".equals(role.getName())))) return true;
        Workspace workspace = scope.workspace();
        if (workspace.getTeam() == null) return false;
        if (workspace.getTeam().getAssignedMentorId() != null
                && Objects.equals(workspace.getTeam().getAssignedMentorId(), actor.getId())) return true;
        return roster.current(workspace.getTeam()).stream()
                .filter(member -> member.getClassMember() != null && member.getClassMember().getUser() != null
                        && Objects.equals(member.getClassMember().getUser().getId(), actor.getId()))
                .anyMatch(member -> ProjectMemberRole.hasRole(member.getRole(), "PM")
                        || access.permitted(actor, "WORKSPACE_UPDATE"));
    }

    private void requireManager(GitActivityScope scope, User actor) {
        if (!canManage(scope, actor)) throw new AccessDeniedException("Only an authorized Workspace Project Manager can link Git activities");
    }

    private static boolean isWithin(Instant value, Instant from, Instant until) {
        return value != null && (from == null || !value.isBefore(from)) && (until == null || value.isBefore(until));
    }

    private static boolean contains(String value, String query) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(query);
    }

    private static void validatePage(LocalDate from, LocalDate to, int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid page or page size");
        }
        if (from != null && to != null && from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start date must not be after end date");
        }
    }

    private GitUnmappedActivityDtos.LinkResult linkResult(TaskGitLink link,
                                                          GitUnmappedActivityDtos.ActivityType type,
                                                          Long activityId, Long projectId, User actor) {
        return new GitUnmappedActivityDtos.LinkResult(link.getId(), type, activityId,
                link.getTask().getId(), projectId, link.getSource(), link.getLinkedAt(),
                actor == null ? null : actor.getFullName());
    }
}
