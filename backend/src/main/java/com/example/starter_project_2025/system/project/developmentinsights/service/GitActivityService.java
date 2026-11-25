package com.example.starter_project_2025.system.project.developmentinsights.service;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommit;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitContributor;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequest;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestState;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitSyncStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLink;
import com.example.starter_project_2025.system.project.developmentinsights.dto.GitActivityDtos;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.TaskGitLinkRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import java.time.Instant;
import java.time.Duration;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.time.temporal.WeekFields;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GitActivityService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final GitActivityScopeService scopes;
    private final GitRepositoryRepository repositories;
    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final GitPullRequestReviewRepository reviews;
    private final TaskGitLinkRepository links;
    private final SprintBacklogRepository tasks;
    private final SprintRepository sprints;
    private final ProjectRepository projects;

    public GitActivityDtos.RepositoryStatus status(Long workspaceId) {
        GitActivityScope scope = scopes.require(workspaceId);
        GitRepository repository = repositories.findFirstByRootProject_IdAndStatusNotAndMockDataFalseOrderByIdDesc(
                        scope.rootProjectId(), GitRepositoryStatus.INACTIVE)
                .orElseGet(() -> repositories.findFirstByRootProject_IdAndMockDataFalseOrderByIdDesc(scope.rootProjectId())
                        .orElseGet(() -> activeRepository(scope.rootProjectId())));
        if (repository == null) return new GitActivityDtos.RepositoryStatus(
                scope.rootProjectId(), false, null, null, null, null, null, false);
        GitSyncStatus syncStatus = repository.getSyncStatus();
        if (syncStatus == GitSyncStatus.READY && repository.getSourceRepository() != null
                && commits.hasPendingSourceMetadata(scope.rootProjectId())) syncStatus = GitSyncStatus.PARTIAL;
        return new GitActivityDtos.RepositoryStatus(scope.rootProjectId(),
                repository.getStatus() != GitRepositoryStatus.INACTIVE,
                repository.getFullName(), repository.getHtmlUrl(), repository.getStatus(),
                syncStatus, repository.getLastSyncedAt(), repository.isMockData());
    }

    public GitActivityDtos.TaskContext taskContext(Long workspaceId, Long taskId) {
        GitActivityScope scope = scopes.require(workspaceId);
        requireTaskRead(scope);
        validateFilters(scope, null, taskId);
        SprintBacklog task = tasks.findById(taskId)
                .filter(item -> Boolean.TRUE.equals(item.getIsActive()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Task was not found in this Workspace"));
        String projectName = projects.findById(task.getProjectId()).map(project -> project.getName()).orElse(null);
        return new GitActivityDtos.TaskContext(task.getId(), task.getProjectId(), projectName,
                task.getTitle(), task.getStatus() == null ? null : task.getStatus().name());
    }

    public GitActivityDtos.FilterOptions filterOptions(Long workspaceId, Long projectId) {
        GitActivityScope scope = scopes.require(workspaceId);
        validateFilters(scope, projectId, null);
        List<GitActivityDtos.FilterProject> projectOptions = projects.findAllById(scope.projectList()).stream()
                .map(project -> new GitActivityDtos.FilterProject(project.getId(), project.getName()))
                .sorted(java.util.Comparator.comparing(GitActivityDtos.FilterProject::name,
                        java.util.Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
        List<Long> projectContributorIds = projectId == null ? List.of(-1L) : scope.contributorsFor(projectId);
        Map<Long, String> memberNames = new HashMap<>();
        scope.membersFor(projectId).forEach(member -> memberNames.put(member.userId(), member.name()));
        java.util.Map<Long, GitActivityDtos.FilterDeveloper> developersByUser = new java.util.LinkedHashMap<>();
        java.util.stream.Stream.concat(
                        commits.findVisibleContributors(scope.rootProjectId(), scope.rootScope(), scope.projectList(),
                                scope.contributorList(), projectId, projectContributorIds).stream(),
                        pullRequests.findVisibleContributors(scope.rootProjectId(), scope.rootScope(), scope.projectList(),
                                scope.contributorList(), projectId, projectContributorIds).stream())
                .sorted(java.util.Comparator.comparing(GitContributor::getId))
                .forEach(contributor -> developersByUser.putIfAbsent(contributor.getUser().getId(),
                        new GitActivityDtos.FilterDeveloper(contributor.getUser().getId(),
                                memberNames.getOrDefault(contributor.getUser().getId(), contributor.label()), contributor.getLogin())));
        List<GitActivityDtos.FilterDeveloper> developerOptions = developersByUser.values().stream()
                .sorted(java.util.Comparator.comparing(GitActivityDtos.FilterDeveloper::name,
                        java.util.Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
        return new GitActivityDtos.FilterOptions(projectOptions, developerOptions);
    }

    public Page<GitActivityDtos.CommitItem> commits(Long workspaceId, String search, String sort,
                                                     int page, int size, Long projectId, Long taskId,
                                                     Long developerId, LocalDate from, LocalDate to) {
        return commits(workspaceId, search, sort, page, size, projectId, taskId, developerId,
                null, null, null, null, null, from, to);
    }

    public Page<GitActivityDtos.CommitItem> commits(Long workspaceId, String search, String sort,
                                                     int page, int size, Long projectId, Long taskId,
                                                     Long developerId, Long contributorId, String branch,
                                                     Boolean unmappedOnly, Boolean includeBots,
                                                     Boolean includeMergeCommits, LocalDate from, LocalDate to) {
        if (page < 0 || size < 1 || size > 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid page or page size");
        if (from != null && to != null && from.isAfter(to)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start date must not be after end date");
        if (developerId != null && contributorId != null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a developer or contributor filter, not both");
        GitActivityScope scope = scopes.require(workspaceId);
        validateFilters(scope, projectId, taskId);
        String normalizedSearch = search == null || search.isBlank() ? null : search.trim();
        String normalizedBranch = branch == null || branch.isBlank() ? null : branch.trim();
        Instant fromTime = from == null ? null : from.atStartOfDay(BUSINESS_ZONE).toInstant();
        Instant untilTime = to == null ? null : to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant();
        Pageable pageable = PageRequest.of(page, size, sort(sort));
        List<Long> contributorsForProject = projectId == null ? List.of(-1L) : scope.contributorsFor(projectId);
        return commits.findVisiblePage(scope.rootProjectId(), scope.rootScope(), scope.projectList(),
                scope.contributorList(), contributorsForProject, normalizedSearch, fromTime,
                untilTime, developerId, contributorId, normalizedBranch, unmappedOnly, includeBots,
                includeMergeCommits, taskId, projectId, pageable).map(commit -> item(commit, scope));
    }

    public GitActivityDtos.CommitAnalytics commitAnalytics(Long workspaceId, String granularity,
                                                            Long projectId, Long taskId, Long developerId,
                                                            Long contributorId, Boolean unmappedOnly, String branch,
                                                            LocalDate from, LocalDate to,
                                                            boolean includeBots, boolean includeMergeCommits) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start date must not be after end date");
        }
        String normalizedGranularity = granularity == null ? "day" : granularity.trim().toLowerCase(Locale.ROOT);
        if (!List.of("day", "week", "month").contains(normalizedGranularity)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Granularity must be day, week or month");
        }
        if (developerId != null && contributorId != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Choose a developer or contributor filter, not both");
        }
        String normalizedBranch = branch == null || branch.isBlank() ? null : branch.trim();
        GitActivityScope scope = scopes.require(workspaceId);
        validateFilters(scope, projectId, taskId);
        List<Long> contributorsForProject = projectId == null ? List.of(-1L) : scope.contributorsFor(projectId);
        List<GitCommit> visible = commits.findVisibleForAnalytics(scope.rootProjectId(), scope.rootScope(),
                scope.projectList(), scope.contributorList(), projectId, contributorsForProject, taskId);
        List<String> branchOptions = visible.stream().map(GitCommit::getFirstSeenBranch)
                .filter(Objects::nonNull).distinct().sorted(String.CASE_INSENSITIVE_ORDER).toList();
        Instant fromTime = from == null ? null : from.atStartOfDay(BUSINESS_ZONE).toInstant();
        Instant untilTime = to == null ? null : to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant();
        Set<Long> eligibleIds = includeBots && includeMergeCommits || visible.isEmpty() ? null
                : new HashSet<>(commits.findConfirmedAnalyticsIds(visible.stream().map(GitCommit::getId).toList(),
                        includeBots, includeMergeCommits));
        Map<CommitKey, GitCommit> unique = new LinkedHashMap<>();
        for (GitCommit commit : visible) {
            GitContributor author = commit.getAuthorContributor();
            if (eligibleIds != null && !eligibleIds.contains(commit.getId())) continue;
            if (fromTime != null && commit.getCommittedAt().isBefore(fromTime)) continue;
            if (untilTime != null && !commit.getCommittedAt().isBefore(untilTime)) continue;
            if (developerId != null && (author == null || author.getUser() == null
                    || !developerId.equals(author.getUser().getId()))) continue;
            if (contributorId != null && (author == null || !contributorId.equals(author.getId()))) continue;
            if (Boolean.TRUE.equals(unmappedOnly) && (author != null
                    && (author.getUser() != null || author.isBot() || commit.isBot()))) continue;
            if (Boolean.FALSE.equals(unmappedOnly) && (author == null || author.getUser() == null)) continue;
            if (normalizedBranch != null && !normalizedBranch.equals(commit.getFirstSeenBranch())) continue;
            unique.putIfAbsent(new CommitKey(commit.getRepository().getId(), commit.getSha()), commit);
        }

        Map<String, GitActivityDtos.CommitTrendPoint> trend = new TreeMap<>();
        Map<String, GitActivityDtos.CommitDeveloperBreakdown> developers = new LinkedHashMap<>();
        Map<String, GitActivityDtos.CommitBranchBreakdown> branches = new LinkedHashMap<>();
        for (GitCommit commit : unique.values()) {
            PeriodBucket period = periodBucket(commit.getCommittedAt(), normalizedGranularity);
            trend.merge(period.key(), new GitActivityDtos.CommitTrendPoint(period.key(), period.label(),
                            period.startDate(), period.endDate(), 1),
                    (left, right) -> new GitActivityDtos.CommitTrendPoint(left.key(), left.label(),
                            left.startDate(), left.endDate(), left.commits() + right.commits()));

            GitContributor author = commit.getAuthorContributor();
            boolean bot = commit.isBot() || author != null && author.isBot();
            Long authorContributorId = author == null ? null : author.getId();
            Long mappedDeveloperId = author == null || author.getUser() == null ? null : author.getUser().getId();
            boolean unmapped = !bot && mappedDeveloperId == null;
            String developerKey = bot ? "bot:" + (authorContributorId == null ? "unknown" : authorContributorId)
                    : mappedDeveloperId != null ? "developer:" + mappedDeveloperId
                    : authorContributorId != null ? "contributor:" + authorContributorId : "unmapped";
            String developerName = bot
                    ? author == null ? "Bot" : author.label()
                    : unmapped ? "Unmapped Contributor" : author.label();
            String login = author == null ? null : author.getLogin();
            developers.merge(developerKey, new GitActivityDtos.CommitDeveloperBreakdown(
                            mappedDeveloperId, authorContributorId, developerName, login, unmapped, bot, 1),
                    (left, right) -> new GitActivityDtos.CommitDeveloperBreakdown(left.developerId(),
                            left.contributorId(), left.name(), left.login(), left.unmapped(), left.bot(),
                            left.commits() + right.commits()));

            String firstSeenBranch = commit.getFirstSeenBranch();
            String branchKey = firstSeenBranch == null ? "(unknown)" : firstSeenBranch;
            branches.merge(branchKey, new GitActivityDtos.CommitBranchBreakdown(firstSeenBranch,
                            firstSeenBranch == null ? "Unknown branch" : firstSeenBranch, 1),
                    (left, right) -> new GitActivityDtos.CommitBranchBreakdown(left.branch(), left.label(),
                            left.commits() + right.commits()));
        }

        List<GitActivityDtos.CommitDeveloperBreakdown> developerRows = developers.values().stream()
                .sorted(Comparator.comparingLong(GitActivityDtos.CommitDeveloperBreakdown::commits).reversed()
                        .thenComparing(GitActivityDtos.CommitDeveloperBreakdown::name,
                                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
        List<GitActivityDtos.CommitBranchBreakdown> branchRows = branches.values().stream()
                .sorted(Comparator.comparingLong(GitActivityDtos.CommitBranchBreakdown::commits).reversed()
                        .thenComparing(GitActivityDtos.CommitBranchBreakdown::label, String.CASE_INSENSITIVE_ORDER))
                .toList();
        long unmappedCommits = developerRows.stream().filter(GitActivityDtos.CommitDeveloperBreakdown::unmapped)
                .mapToLong(GitActivityDtos.CommitDeveloperBreakdown::commits).sum();
        return new GitActivityDtos.CommitAnalytics(unique.size(), normalizedGranularity,
                trend.values().stream().toList(), developerRows, branchRows, branchOptions, unmappedCommits);
    }

    public GitActivityDtos.PullRequestAnalytics pullRequestAnalytics(Long workspaceId,
                                                                      Long projectId, Long taskId,
                                                                      Long developerId,
                                                                      LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start date must not be after end date");
        }
        GitActivityScope scope = scopes.require(workspaceId);
        validateFilters(scope, projectId, taskId);
        Instant fromTime = from == null ? null : from.atStartOfDay(BUSINESS_ZONE).toInstant();
        Instant untilTime = to == null ? null : to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant();
        List<Long> contributorsForProject = projectId == null ? List.of(-1L) : scope.contributorsFor(projectId);
        List<GitPullRequest> visible = pullRequests.findVisibleForAnalytics(scope.rootProjectId(), scope.rootScope(),
                scope.projectList(), scope.contributorList(), contributorsForProject, fromTime, untilTime,
                developerId, projectId, taskId);
        Map<PullRequestKey, GitPullRequest> unique = new LinkedHashMap<>();
        for (GitPullRequest pullRequest : visible) {
            unique.putIfAbsent(new PullRequestKey(pullRequest.getRepository().getId(), pullRequest.getExternalId()), pullRequest);
        }

        long open = 0;
        long merged = 0;
        long closedWithoutMerge = 0;
        Map<String, GitActivityDtos.PullRequestDeveloperBreakdown> developers = new LinkedHashMap<>();
        List<Long> mergeDurationsMillis = new java.util.ArrayList<>();
        for (GitPullRequest pullRequest : unique.values()) {
            switch (pullRequest.getState()) {
                case OPEN -> open++;
                case MERGED -> merged++;
                case CLOSED -> closedWithoutMerge++;
            }
            GitContributor author = pullRequest.getAuthorContributor();
            Long mappedDeveloperId = author == null || author.getUser() == null ? null : author.getUser().getId();
            Long contributorId = author == null ? null : author.getId();
            boolean unmapped = mappedDeveloperId == null;
            String developerKey = mappedDeveloperId != null ? "developer:" + mappedDeveloperId
                    : contributorId != null ? "contributor:" + contributorId : "unmapped";
            String name = unmapped ? "Unmapped Contributor" : author.label();
            String login = author == null ? null : author.getLogin();
            GitActivityDtos.PullRequestDeveloperBreakdown row = new GitActivityDtos.PullRequestDeveloperBreakdown(
                    mappedDeveloperId, contributorId, name, login, unmapped,
                    1, pullRequest.getState() == GitPullRequestState.OPEN ? 1 : 0,
                    pullRequest.getState() == GitPullRequestState.MERGED ? 1 : 0,
                    pullRequest.getState() == GitPullRequestState.CLOSED ? 1 : 0);
            developers.merge(developerKey, row, (left, right) -> new GitActivityDtos.PullRequestDeveloperBreakdown(
                    left.developerId(), left.contributorId(), left.name(), left.login(), left.unmapped(),
                    left.total() + right.total(), left.open() + right.open(), left.merged() + right.merged(),
                    left.closedWithoutMerge() + right.closedWithoutMerge()));

            if (pullRequest.getState() == GitPullRequestState.MERGED && pullRequest.getCreatedAt() != null
                    && pullRequest.getMergedAt() != null && !pullRequest.getMergedAt().isBefore(pullRequest.getCreatedAt())) {
                mergeDurationsMillis.add(Duration.between(pullRequest.getCreatedAt(), pullRequest.getMergedAt()).toMillis());
            }
        }
        List<Long> sortedDurations = mergeDurationsMillis.stream().sorted().toList();
        Double averageHours = sortedDurations.isEmpty() ? null
                : sortedDurations.stream().mapToLong(Long::longValue).average().orElseThrow() / 3_600_000d;
        Double medianHours = sortedDurations.isEmpty() ? null : median(sortedDurations) / 3_600_000d;
        List<GitActivityDtos.PullRequestDeveloperBreakdown> developerRows = developers.values().stream()
                .sorted(Comparator.comparingLong(GitActivityDtos.PullRequestDeveloperBreakdown::total).reversed()
                        .thenComparing(GitActivityDtos.PullRequestDeveloperBreakdown::name,
                                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
        return new GitActivityDtos.PullRequestAnalytics(unique.size(), open, merged, closedWithoutMerge,
                averageHours, medianHours, developerRows);
    }

    public GitActivityDtos.DeveloperActivity developerActivity(Long workspaceId, Long projectId,
                                                                 LocalDate from, LocalDate to,
                                                                 Long developerId) {
        validateDateRange(from, to);
        GitActivityScope scope = scopes.require(workspaceId);
        validateFilters(scope, projectId, null);
        validateDeveloperFilter(scope, projectId, developerId);
        ActivitySnapshot snapshot = activitySnapshot(scope, projectId, from, to, developerId);
        List<GitActivityDtos.DeveloperActivityRow> rows = developerRows(scope, projectId, snapshot, developerId);
        return new GitActivityDtos.DeveloperActivity(rows, snapshot.commits().size(),
                countPullRequestsCreated(snapshot), countPullRequestsMerged(snapshot));
    }

    public GitActivityDtos.ReportOptions reportOptions(Long workspaceId, Long projectId) {
        GitActivityScope scope = scopes.require(workspaceId);
        validateFilters(scope, projectId, null);
        List<GitActivityDtos.FilterProject> projectOptions = projects.findAllById(scope.projectList()).stream()
                .map(project -> new GitActivityDtos.FilterProject(project.getId(), project.getName()))
                .sorted(Comparator.comparing(GitActivityDtos.FilterProject::name,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
        List<GitActivityDtos.SprintOption> sprintOptions = sprints
                .findAllByProjectIdInAndIsActiveTrueOrderByIdAsc(scope.projectList()).stream()
                .filter(sprint -> projectId == null
                        || scope.rootScope() && Objects.equals(scope.rootProjectId(), projectId)
                        || projectId.equals(sprint.getProjectId()))
                .map(sprint -> new GitActivityDtos.SprintOption(sprint.getId(), sprint.getProjectId(),
                        sprint.getName(), sprint.getStartDate(), sprint.getEndDate()))
                .toList();
        List<GitActivityDtos.FilterDeveloper> developerOptions = scope.membersFor(projectId).stream()
                .map(member -> new GitActivityDtos.FilterDeveloper(member.userId(), member.name(), member.login()))
                .toList();
        return new GitActivityDtos.ReportOptions(projectOptions, sprintOptions, developerOptions);
    }

    public GitActivityDtos.SprintDevelopmentReport sprintDevelopmentReport(Long workspaceId, Long sprintId) {
        GitActivityScope scope = scopes.require(workspaceId);
        requireTaskRead(scope);
        Sprint sprint = requireSprintInScope(scope, sprintId, null);
        Long projectId = sprint.getProjectId();
        List<SprintBacklog> sprintTasks = activeSprintTasks(scope, sprint);
        LocalDate from = sprint.getStartDate() == null ? null : sprint.getStartDate().toLocalDate();
        LocalDate to = sprint.getEndDate() == null ? null : sprint.getEndDate().toLocalDate();
        ActivitySnapshot snapshot = activitySnapshot(scope, projectId, from, to, null);
        TaskCounts taskCounts = countTasks(sprintTasks);
        GitActivityDtos.SprintOverview overview = new GitActivityDtos.SprintOverview(sprint.getId(),
                sprint.getName(), sprint.getStartDate(), sprint.getEndDate(), taskCounts.total(),
                taskCounts.todo(), taskCounts.inProgress(), taskCounts.review(), taskCounts.done(),
                taskCounts.total() - taskCounts.done());
        GitRepository repository = reportRepository(scope.rootProjectId());
        return new GitActivityDtos.SprintDevelopmentReport(overview, activitySummary(snapshot),
                taskTraceability(sprintTasks, snapshot, true), developerRows(scope, projectId, snapshot, null),
                repository != null && repository.getStatus() != GitRepositoryStatus.INACTIVE,
                repository != null && repository.isMockData());
    }

    public GitActivityDtos.ProjectDevelopmentReport projectDevelopmentReport(Long workspaceId,
                                                                              Long projectId,
                                                                              Long sprintId,
                                                                              LocalDate from,
                                                                              LocalDate to,
                                                                              Long developerId) {
        validateDateRange(from, to);
        GitActivityScope scope = scopes.require(workspaceId);
        requireTaskRead(scope);
        validateFilters(scope, projectId, null);
        Sprint sprint = sprintId == null ? null : requireSprintInScope(scope, sprintId, projectId);
        Long effectiveProjectId = sprint == null ? projectId : sprint.getProjectId();
        validateDeveloperFilter(scope, effectiveProjectId, developerId);

        LocalDate effectiveFrom = later(from, sprint == null || sprint.getStartDate() == null
                ? null : sprint.getStartDate().toLocalDate());
        LocalDate effectiveTo = earlier(to, sprint == null || sprint.getEndDate() == null
                ? null : sprint.getEndDate().toLocalDate());
        ActivitySnapshot snapshot = effectiveFrom != null && effectiveTo != null && effectiveFrom.isAfter(effectiveTo)
                ? ActivitySnapshot.empty()
                : activitySnapshot(scope, effectiveProjectId, effectiveFrom, effectiveTo, developerId);

        List<SprintBacklog> reportTasks = sprint == null
                ? tasks.findAllByProjectIdInAndIsActiveTrueOrderByIdAsc(effectiveProjectIds(scope, effectiveProjectId))
                : activeSprintTasks(scope, sprint);
        TaskCounts taskCounts = countTasks(reportTasks);
        GitRepository repository = reportRepository(scope.rootProjectId());
        Long nameProjectId = effectiveProjectId == null ? scope.rootProjectId() : effectiveProjectId;
        String projectName = projects.findById(nameProjectId).map(project -> project.getName()).orElse(null);
        return new GitActivityDtos.ProjectDevelopmentReport(scope.rootProjectId(), effectiveProjectId,
                projectName, repository == null ? null : repository.getFullName(),
                repository == null ? null : repository.getHtmlUrl(),
                repository != null && repository.getStatus() != GitRepositoryStatus.INACTIVE,
                repository != null && repository.isMockData(), taskCounts.total(), taskCounts.todo(),
                taskCounts.inProgress(), taskCounts.review(), taskCounts.done(), activitySummary(snapshot),
                taskTraceability(reportTasks, snapshot, false),
                developerRows(scope, effectiveProjectId, snapshot, developerId));
    }

    private ActivitySnapshot activitySnapshot(GitActivityScope scope, Long projectId,
                                               LocalDate from, LocalDate to, Long developerId) {
        if (from != null && to != null && from.isAfter(to)) return ActivitySnapshot.empty();
        Instant fromTime = from == null ? null : from.atStartOfDay(BUSINESS_ZONE).toInstant();
        Instant untilTime = to == null ? null : to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant();
        List<Long> projectContributors = projectId == null ? scope.contributorList() : scope.contributorsFor(projectId);
        Map<CommitKey, GitCommit> uniqueCommits = new LinkedHashMap<>();
        for (GitCommit commit : commits.findVisibleForAnalytics(scope.rootProjectId(), scope.rootScope(),
                scope.projectList(), scope.contributorList(), projectId, projectContributors, null)) {
            if (fromTime != null && commit.getCommittedAt().isBefore(fromTime)) continue;
            if (untilTime != null && !commit.getCommittedAt().isBefore(untilTime)) continue;
            if (developerId != null && (commit.getAuthorContributor() == null
                    || commit.getAuthorContributor().getUser() == null
                    || !developerId.equals(commit.getAuthorContributor().getUser().getId()))) continue;
            uniqueCommits.putIfAbsent(new CommitKey(commit.getRepository().getId(), commit.getSha()), commit);
        }
        Map<PullRequestKey, GitPullRequest> uniquePullRequests = new LinkedHashMap<>();
        for (GitPullRequest pullRequest : pullRequests.findVisibleForDevelopmentReport(scope.rootProjectId(),
                scope.rootScope(), scope.projectList(), scope.contributorList(), projectContributors,
                fromTime, untilTime, GitPullRequestState.MERGED, developerId, projectId, null)) {
            uniquePullRequests.putIfAbsent(new PullRequestKey(pullRequest.getRepository().getId(),
                    pullRequest.getExternalId()), pullRequest);
        }
        return new ActivitySnapshot(List.copyOf(uniqueCommits.values()), List.copyOf(uniquePullRequests.values()),
                fromTime, untilTime);
    }

    private List<GitActivityDtos.DeveloperActivityRow> developerRows(GitActivityScope scope, Long projectId,
                                                                      ActivitySnapshot snapshot,
                                                                      Long selectedDeveloperId) {
        Map<Long, GitActivityScope.MemberIdentity> membersById = new LinkedHashMap<>();
        scope.membersFor(projectId).forEach(member -> membersById.put(member.userId(), member));
        Map<String, DeveloperAccumulator> accumulators = new LinkedHashMap<>();
        membersById.values().forEach(member -> accumulators.put("developer:" + member.userId(),
                new DeveloperAccumulator(member.userId(), null, member.name(), member.login(), false)));

        for (GitCommit commit : snapshot.commits()) {
            GitContributor contributor = commit.getAuthorContributor();
            DeveloperAccumulator row = developerAccumulator(accumulators, membersById, contributor);
            row.recordCommit(commit.getCommittedAt());
        }
        for (GitPullRequest pullRequest : snapshot.pullRequests()) {
            GitContributor contributor = pullRequest.getAuthorContributor();
            DeveloperAccumulator row = developerAccumulator(accumulators, membersById, contributor);
            row.recordPullRequest(pullRequest.getCreatedAt(), pullRequest.getMergedAt(),
                    pullRequest.getState() == GitPullRequestState.MERGED,
                    snapshot.fromTime(), snapshot.untilTime());
        }
        return accumulators.values().stream()
                .filter(row -> selectedDeveloperId == null || selectedDeveloperId.equals(row.developerId))
                .map(DeveloperAccumulator::toRow)
                .sorted(Comparator.comparingLong((GitActivityDtos.DeveloperActivityRow row) ->
                                row.commits() + row.pullRequests() + row.mergedPullRequests()).reversed()
                        .thenComparing(GitActivityDtos.DeveloperActivityRow::unmapped)
                        .thenComparing(GitActivityDtos.DeveloperActivityRow::name,
                                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
    }

    private DeveloperAccumulator developerAccumulator(Map<String, DeveloperAccumulator> accumulators,
                                                       Map<Long, GitActivityScope.MemberIdentity> membersById,
                                                       GitContributor contributor) {
        Long userId = contributor == null || contributor.getUser() == null ? null : contributor.getUser().getId();
        GitActivityScope.MemberIdentity member = userId == null ? null : membersById.get(userId);
        if (member != null) return accumulators.get("developer:" + userId);
        Long contributorId = contributor == null ? null : contributor.getId();
        String key = contributorId == null ? "unmapped:unknown" : "unmapped:" + contributorId;
        return accumulators.computeIfAbsent(key, ignored -> new DeveloperAccumulator(null, contributorId,
                contributor == null ? "Unknown contributor" : contributor.label(),
                contributor == null ? null : contributor.getLogin(), true));
    }

    private GitActivityDtos.GitActivitySummary activitySummary(ActivitySnapshot snapshot) {
        long created = countPullRequestsCreated(snapshot);
        long merged = countPullRequestsMerged(snapshot);
        long open = snapshot.pullRequests().stream()
                .filter(pr -> pr.getState() == GitPullRequestState.OPEN)
                .filter(pr -> isWithin(pr.getCreatedAt(), snapshot.fromTime(), snapshot.untilTime())).count();
        long closed = snapshot.pullRequests().stream()
                .filter(pr -> pr.getState() == GitPullRequestState.CLOSED)
                .filter(pr -> isWithin(pr.getCreatedAt(), snapshot.fromTime(), snapshot.untilTime())).count();
        return new GitActivityDtos.GitActivitySummary(snapshot.commits().size(), created, merged, open, closed);
    }

    private long countPullRequestsCreated(ActivitySnapshot snapshot) {
        return snapshot.pullRequests().stream()
                .filter(pr -> isWithin(pr.getCreatedAt(), snapshot.fromTime(), snapshot.untilTime())).count();
    }

    private long countPullRequestsMerged(ActivitySnapshot snapshot) {
        return snapshot.pullRequests().stream()
                .filter(pr -> pr.getState() == GitPullRequestState.MERGED)
                .filter(pr -> isWithin(pr.getMergedAt(), snapshot.fromTime(), snapshot.untilTime())).count();
    }

    private static boolean isWithin(Instant at, Instant fromTime, Instant untilTime) {
        return at != null && (fromTime == null || !at.isBefore(fromTime))
                && (untilTime == null || at.isBefore(untilTime));
    }

    private GitActivityDtos.TaskTraceability taskTraceability(List<SprintBacklog> reportTasks,
                                                               ActivitySnapshot snapshot,
                                                               boolean useAllTaskLinks) {
        Set<Long> taskIds = reportTasks.stream().map(SprintBacklog::getId).collect(java.util.stream.Collectors.toSet());
        Set<Long> commitIds = snapshot.commits().stream().map(GitCommit::getId).collect(java.util.stream.Collectors.toSet());
        Set<Long> pullRequestIds = snapshot.pullRequests().stream().map(GitPullRequest::getId)
                .collect(java.util.stream.Collectors.toSet());
        List<TaskGitLink> activityLinks = new java.util.ArrayList<>();
        if (!commitIds.isEmpty()) activityLinks.addAll(links.findAllByCommit_IdIn(commitIds));
        if (!pullRequestIds.isEmpty()) activityLinks.addAll(links.findAllByPullRequest_IdIn(pullRequestIds));
        List<TaskGitLink> taskLinks = useAllTaskLinks && !taskIds.isEmpty()
                ? links.findAllByTask_IdInOrderByTask_IdAsc(taskIds)
                : activityLinks.stream().filter(link -> taskIds.contains(link.getTask().getId())).toList();

        Set<Long> tasksWithCommit = new HashSet<>();
        Set<Long> tasksWithPullRequest = new HashSet<>();
        Set<Long> linkedCommitIds = new HashSet<>();
        Set<Long> linkedPullRequestIds = new HashSet<>();
        activityLinks.forEach(link -> {
            if (link.getCommit() != null) linkedCommitIds.add(link.getCommit().getId());
            if (link.getPullRequest() != null) linkedPullRequestIds.add(link.getPullRequest().getId());
        });
        for (TaskGitLink link : taskLinks) {
            if (link.getCommit() != null) tasksWithCommit.add(link.getTask().getId());
            if (link.getPullRequest() != null) tasksWithPullRequest.add(link.getTask().getId());
        }
        Set<Long> tasksWithActivity = new HashSet<>(tasksWithCommit);
        tasksWithActivity.addAll(tasksWithPullRequest);
        long commitsWithoutTask = snapshot.commits().stream()
                .filter(commit -> !linkedCommitIds.contains(commit.getId())).count();
        long pullRequestsWithoutTask = snapshot.pullRequests().stream()
                .filter(pr -> !linkedPullRequestIds.contains(pr.getId())).count();
        return new GitActivityDtos.TaskTraceability(tasksWithCommit.size(), tasksWithPullRequest.size(),
                Math.max(0, taskIds.size() - tasksWithActivity.size()), commitsWithoutTask, pullRequestsWithoutTask);
    }

    private TaskCounts countTasks(List<SprintBacklog> reportTasks) {
        long todo = reportTasks.stream().filter(task -> task.getStatus() == SprintBacklogStatus.TODO).count();
        long inProgress = reportTasks.stream().filter(task -> task.getStatus() == SprintBacklogStatus.IN_PROGRESS).count();
        long review = reportTasks.stream().filter(task -> task.getStatus() == SprintBacklogStatus.REVIEW).count();
        long done = reportTasks.stream().filter(task -> task.getStatus() == SprintBacklogStatus.DONE).count();
        return new TaskCounts(reportTasks.size(), todo, inProgress, review, done);
    }

    private List<SprintBacklog> activeSprintTasks(GitActivityScope scope, Sprint sprint) {
        return tasks.findBySprintIdOrderByIdAsc(sprint.getId()).stream()
                .filter(task -> Boolean.TRUE.equals(task.getIsActive()))
                .filter(task -> Objects.equals(task.getProjectId(), sprint.getProjectId()))
                .filter(task -> scope.projectIds().contains(task.getProjectId()))
                .toList();
    }

    private Sprint requireSprintInScope(GitActivityScope scope, Long sprintId, Long requestedProjectId) {
        Sprint sprint = sprints.findById(sprintId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Sprint was not found"));
        boolean rootAggregate = scope.rootScope() && Objects.equals(scope.rootProjectId(), requestedProjectId);
        if (sprint.getProjectId() == null || !scope.projectIds().contains(sprint.getProjectId())
                || requestedProjectId != null && !requestedProjectId.equals(sprint.getProjectId()) && !rootAggregate) {
            throw new AccessDeniedException("This Sprint is outside the current Workspace Project scope");
        }
        return sprint;
    }

    private void requireTaskRead(GitActivityScope scope) {
        if (!scope.canReadTasks()) throw new AccessDeniedException("Task read permission is required");
    }

    private void validateDeveloperFilter(GitActivityScope scope, Long projectId, Long developerId) {
        if (developerId != null && scope.membersFor(projectId).stream()
                .noneMatch(member -> developerId.equals(member.userId()))) {
            throw new AccessDeniedException("The selected developer is outside the current Workspace scope");
        }
    }

    private List<Long> effectiveProjectIds(GitActivityScope scope, Long projectId) {
        return projectId == null || scope.rootScope() && Objects.equals(scope.rootProjectId(), projectId)
                ? scope.projectList() : List.of(projectId);
    }

    private GitRepository reportRepository(Long rootId) {
        return repositories.findFirstByRootProject_IdAndStatusNotAndMockDataFalseOrderByIdDesc(rootId,
                        GitRepositoryStatus.INACTIVE)
                .orElseGet(() -> repositories.findFirstByRootProject_IdAndMockDataFalseOrderByIdDesc(rootId)
                        .orElseGet(() -> activeRepository(rootId)));
    }

    private LocalDate later(LocalDate left, LocalDate right) {
        if (left == null) return right;
        if (right == null) return left;
        return left.isAfter(right) ? left : right;
    }

    private LocalDate earlier(LocalDate left, LocalDate right) {
        if (left == null) return right;
        if (right == null) return left;
        return left.isBefore(right) ? left : right;
    }

    private void validateDateRange(LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start date must not be after end date");
        }
    }

    private double median(List<Long> sortedValues) {
        int middle = sortedValues.size() / 2;
        if (sortedValues.size() % 2 == 1) return sortedValues.get(middle);
        return (sortedValues.get(middle - 1) + sortedValues.get(middle)) / 2d;
    }

    public Page<GitActivityDtos.PullRequestItem> pullRequests(Long workspaceId, String search, String sort,
                                                               int page, int size, Long projectId, Long taskId,
                                                               Long developerId, LocalDate from, LocalDate to) {
        if (page < 0 || size < 1 || size > 100) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid page or page size");
        if (from != null && to != null && from.isAfter(to)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start date must not be after end date");
        GitActivityScope scope = scopes.require(workspaceId);
        validateFilters(scope, projectId, taskId);
        String normalizedSearch = search == null || search.isBlank() ? null : search.trim();
        Instant fromTime = from == null ? null : from.atStartOfDay(BUSINESS_ZONE).toInstant();
        Instant untilTime = to == null ? null : to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant();
        Pageable pageable = PageRequest.of(page, size, pullRequestSort(sort));
        List<Long> contributorsForProject = projectId == null ? List.of(-1L) : scope.contributorsFor(projectId);
        return pullRequests.findVisiblePage(scope.rootProjectId(), scope.rootScope(), scope.projectList(),
                scope.contributorList(), contributorsForProject, normalizedSearch, fromTime,
                untilTime, developerId, taskId, projectId, pageable).map(pr -> pullRequestItem(pr, scope));
    }

    public GitActivityDtos.CommitDetails commit(Long workspaceId, Long commitId) {
        GitActivityScope scope = scopes.require(workspaceId);
        GitCommit commit = commits.findInRoot(scope.rootProjectId(), commitId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Commit was not found"));
        if (!commits.isVisible(scope.rootProjectId(), commitId, scope.rootScope(), scope.projectList(), scope.contributorList())) {
            throw new AccessDeniedException("This commit is outside the current Workspace scope");
        }
        GitRepository repository = commit.getRepository();
        return new GitActivityDtos.CommitDetails(commit.getId(), commit.getSha(), commit.getMessage(),
                authorName(commit), login(commit), commit.getCommittedAt(), commit.getFirstSeenBranch(),
                commit.getHtmlUrl(), repository.getFullName(), repository.getHtmlUrl(), taskLinks(commit, scope));
    }

    public GitActivityDtos.PullRequestDetails pullRequest(Long workspaceId, Long pullRequestId) {
        GitActivityScope scope = scopes.require(workspaceId);
        GitPullRequest pr = pullRequests.findInRoot(scope.rootProjectId(), pullRequestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pull Request was not found"));
        if (!pullRequests.isVisible(scope.rootProjectId(), pullRequestId, scope.rootScope(),
                scope.projectList(), scope.contributorList())) {
            throw new AccessDeniedException("This Pull Request is outside the current Workspace scope");
        }
        return new GitActivityDtos.PullRequestDetails(pr.getId(), pr.getNumber(), pr.getTitle(), pr.getBody(),
                authorName(pr.getAuthorContributor()), login(pr.getAuthorContributor()), pr.getSourceBranch(),
                pr.getTargetBranch(), pr.getState(), pr.isDraft(), pr.getCreatedAt(), pr.getMergedAt(),
                pr.getClosedAt(), pr.getHtmlUrl(), pr.getRepository().getFullName(), taskLinks(pr, scope),
                reviews.findAllByPullRequest_IdOrderBySubmittedAtAscIdAsc(pr.getId()).stream()
                        .map(this::reviewItem).toList());
    }

    private void validateFilters(GitActivityScope scope, Long projectId, Long taskId) {
        if (projectId != null && !scope.projectIds().contains(projectId)) {
            throw new AccessDeniedException("The selected Project is outside the current Workspace scope");
        }
        if (taskId != null) {
            if (!scope.canReadTasks()) throw new AccessDeniedException("Task read permission is required");
            SprintBacklog task = tasks.findById(taskId).orElse(null);
            if (task == null || !isProjectInScope(scope, task.getProjectId())) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Task was not found in this Workspace");
            }
        }
    }

    private boolean isProjectInScope(GitActivityScope scope, Long projectId) {
        return projectId != null && scope.projectIds().contains(projectId);
    }

    private PeriodBucket periodBucket(Instant committedAt, String granularity) {
        LocalDate date = committedAt.atZone(BUSINESS_ZONE).toLocalDate();
        if ("week".equals(granularity)) {
            LocalDate start = date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            LocalDate end = start.plusDays(6);
            int week = date.get(WeekFields.ISO.weekOfWeekBasedYear());
            int year = date.get(WeekFields.ISO.weekBasedYear());
            return new PeriodBucket(start.toString(), String.format(Locale.ROOT, "W%02d %d", week, year), start, end);
        }
        if ("month".equals(granularity)) {
            YearMonth month = YearMonth.from(date);
            return new PeriodBucket(month.toString(), month.format(DateTimeFormatter.ofPattern("MMM yyyy", Locale.ENGLISH)),
                    month.atDay(1), month.atEndOfMonth());
        }
        return new PeriodBucket(date.toString(), date.format(DateTimeFormatter.ofPattern("d MMM", Locale.ENGLISH)), date, date);
    }

    private record CommitKey(Long repositoryId, String sha) { }
    private record PullRequestKey(Long repositoryId, Long externalId) { }
    private record ActivitySnapshot(List<GitCommit> commits, List<GitPullRequest> pullRequests,
                                    Instant fromTime, Instant untilTime) {
        static ActivitySnapshot empty() { return new ActivitySnapshot(List.of(), List.of(), null, null); }
    }
    private record TaskCounts(long total, long todo, long inProgress, long review, long done) { }
    private record PeriodBucket(String key, String label, LocalDate startDate, LocalDate endDate) { }

    private static final class DeveloperAccumulator {
        private final Long developerId;
        private final Long contributorId;
        private final String name;
        private final String login;
        private final boolean unmapped;
        private final Set<LocalDate> activityDays = new HashSet<>();
        private long commits;
        private long pullRequests;
        private long mergedPullRequests;
        private Instant lastActiveAt;

        private DeveloperAccumulator(Long developerId, Long contributorId, String name,
                                     String login, boolean unmapped) {
            this.developerId = developerId;
            this.contributorId = contributorId;
            this.name = name;
            this.login = login;
            this.unmapped = unmapped;
        }

        private void recordCommit(Instant at) {
            commits++;
            recordActivity(at);
        }

        private void recordPullRequest(Instant createdAt, Instant mergedAt, boolean merged,
                                       Instant fromTime, Instant untilTime) {
            boolean createdInWindow = isWithin(createdAt, fromTime, untilTime);
            boolean mergedInWindow = merged && isWithin(mergedAt, fromTime, untilTime);
            if (createdInWindow) {
                pullRequests++;
                recordActivity(createdAt);
            }
            if (mergedInWindow) {
                mergedPullRequests++;
                recordActivity(mergedAt);
            }
        }

        private void recordActivity(Instant at) {
            if (at == null) return;
            activityDays.add(at.atZone(BUSINESS_ZONE).toLocalDate());
            if (lastActiveAt == null || at.isAfter(lastActiveAt)) lastActiveAt = at;
        }

        private GitActivityDtos.DeveloperActivityRow toRow() {
            return new GitActivityDtos.DeveloperActivityRow(developerId, contributorId, name, login,
                    unmapped, commits == 0 && pullRequests == 0 && mergedPullRequests == 0, commits, pullRequests,
                    mergedPullRequests, activityDays.size(), lastActiveAt);
        }
    }

    private Sort sort(String value) {
        String normalized = value == null ? "newest" : value.trim().toLowerCase();
        return switch (normalized) {
            case "newest" -> Sort.by(Sort.Direction.DESC, "committedAt").and(Sort.by(Sort.Direction.DESC, "id"));
            case "oldest" -> Sort.by(Sort.Direction.ASC, "committedAt").and(Sort.by(Sort.Direction.ASC, "id"));
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sort must be newest or oldest");
        };
    }

    private Sort pullRequestSort(String value) {
        String normalized = value == null ? "newest" : value.trim().toLowerCase();
        return switch (normalized) {
            case "newest" -> Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "id"));
            case "oldest" -> Sort.by(Sort.Direction.ASC, "createdAt").and(Sort.by(Sort.Direction.ASC, "id"));
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Sort must be newest or oldest");
        };
    }

    private GitActivityDtos.CommitItem item(GitCommit commit, GitActivityScope scope) {
        return new GitActivityDtos.CommitItem(commit.getId(), commit.getSha(), shortSha(commit.getSha()),
                commit.getMessage(), authorName(commit), login(commit), commit.getCommittedAt(),
                commit.getFirstSeenBranch(), commit.getHtmlUrl(), taskLinks(commit, scope));
    }

    private GitActivityDtos.PullRequestItem pullRequestItem(GitPullRequest pr, GitActivityScope scope) {
        return new GitActivityDtos.PullRequestItem(pr.getId(), pr.getNumber(), pr.getTitle(),
                authorName(pr.getAuthorContributor()), login(pr.getAuthorContributor()), pr.getState(),
                pr.isDraft(), pr.getCreatedAt(), pr.getMergedAt(), pr.getHtmlUrl(), taskLinks(pr, scope));
    }

    private GitActivityDtos.PullRequestReview reviewItem(GitPullRequestReview review) {
        return new GitActivityDtos.PullRequestReview(review.getId(), review.getExternalId(),
                authorName(review.getReviewerContributor()), login(review.getReviewerContributor()),
                review.getState(), review.getSubmittedAt(), review.isSelfReview());
    }

    private List<GitActivityDtos.TaskLink> taskLinks(GitCommit commit, GitActivityScope scope) {
        if (!scope.canReadTasks()) return List.of();
        return links.findAllByCommit_IdOrderByTask_IdAsc(commit.getId()).stream()
                .filter(link -> isProjectInScope(scope, link.getTask().getProjectId()))
                .map(link -> {
                    SprintBacklog task = link.getTask();
                    return new GitActivityDtos.TaskLink(task.getId(), task.getProjectId(), task.getTitle(), link.getSource());
                }).toList();
    }

    private List<GitActivityDtos.TaskLink> taskLinks(GitPullRequest pullRequest, GitActivityScope scope) {
        if (!scope.canReadTasks()) return List.of();
        return links.findAllByPullRequest_IdOrderByTask_IdAsc(pullRequest.getId()).stream()
                .filter(link -> isProjectInScope(scope, link.getTask().getProjectId()))
                .map(link -> {
                    SprintBacklog task = link.getTask();
                    return new GitActivityDtos.TaskLink(task.getId(), task.getProjectId(), task.getTitle(), link.getSource());
                }).toList();
    }

    private GitRepository activeRepository(Long rootId) {
        return repositories.findFirstByRootProject_IdAndStatusNotOrderByIdDesc(rootId, GitRepositoryStatus.INACTIVE).orElse(null);
    }

    private String authorName(GitCommit commit) {
        return commit.getAuthorContributor() == null ? "Unknown contributor" : commit.getAuthorContributor().label();
    }

    private String authorName(GitContributor contributor) {
        return contributor == null ? "Unknown contributor" : contributor.label();
    }

    private String login(GitContributor contributor) {
        return contributor == null ? null : contributor.getLogin();
    }

    private String login(GitCommit commit) {
        return commit.getAuthorContributor() == null ? null : commit.getAuthorContributor().getLogin();
    }

    private String shortSha(String sha) {
        return sha == null || sha.length() <= 7 ? sha : sha.substring(0, 7);
    }
}
