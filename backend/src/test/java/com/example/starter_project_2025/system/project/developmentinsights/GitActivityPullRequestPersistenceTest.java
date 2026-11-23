package com.example.starter_project_2025.system.project.developmentinsights;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitContributor;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequest;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestReviewState;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestState;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitSyncStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLink;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLinkSource;
import com.example.starter_project_2025.system.project.developmentinsights.dto.GitActivityDtos;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitContributorRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.TaskGitLinkRepository;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitActivityScope;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitActivityScopeService;
import com.example.starter_project_2025.system.project.developmentinsights.service.GitActivityService;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.test.context.ActiveProfiles;

@DataJpaTest
@Import(GitActivityService.class)
@ActiveProfiles("test")
class GitActivityPullRequestPersistenceTest {
    @Autowired TenantRepository tenants;
    @Autowired UserRepository users;
    @Autowired ProjectRepository projects;
    @Autowired GitRepositoryRepository repositories;
    @Autowired GitContributorRepository contributors;
    @Autowired GitPullRequestRepository pullRequests;
    @Autowired GitPullRequestReviewRepository reviews;
    @Autowired TaskGitLinkRepository links;
    @Autowired SprintBacklogRepository tasks;
    @Autowired GitActivityService service;
    @MockBean GitActivityScopeService scopes;

    Project root;
    Project module;
    Project otherModule;
    GitRepository repository;
    GitContributor author;
    GitContributor reviewer;
    SprintBacklog task;
    SprintBacklog otherTask;
    GitPullRequest merged;
    GitPullRequest open;
    GitPullRequest closed;
    GitPullRequestReview firstReview;

    @BeforeEach
    void setUp() {
        Tenant tenant = tenants.saveAndFlush(Tenant.builder()
                .code("PR-GIT-" + UUID.randomUUID()).name("Git Pull Request fixture").build());
        root = project("PR-ROOT-", tenant, null);
        module = project("PR-MODULE-", tenant, root);
        otherModule = project("PR-OTHER-MODULE-", tenant, root);

        repository = new GitRepository();
        repository.setRootProject(root);
        repository.setExternalId(510_000L + root.getId());
        repository.setOwner("fixture");
        repository.setName("pull-request-test");
        repository.setFullName("fixture/pull-request-test");
        repository.setDefaultBranch("main");
        repository.setStatus(GitRepositoryStatus.ACTIVE);
        repository.setSyncStatus(GitSyncStatus.READY);
        repository.setMockData(false);
        repository = repositories.saveAndFlush(repository);

        author = contributor(820_000L + root.getId(), "pr-author", "PR Author");
        reviewer = contributor(830_000L + root.getId(), "pr-reviewer", "PR Reviewer");
        task = new SprintBacklog();
        task.setProjectId(module.getId());
        task.setTitle("Pull Request linked Task");
        task = tasks.saveAndFlush(task);
        otherTask = new SprintBacklog();
        otherTask.setProjectId(otherModule.getId());
        otherTask.setTitle("Shared Pull Request Task");
        otherTask = tasks.saveAndFlush(otherTask);

        merged = pullRequest(11, "Improve activity filters", "Reduce query work for the complete history.",
                GitPullRequestState.MERGED, Instant.parse("2026-11-15T09:00:00Z"),
                "feature/activity-filters", "main", "https://github.com/fixture/pull-request-test/pull/11");
        open = pullRequest(12, "Keep module permissions", "Check assignment scope for every Task link.",
                GitPullRequestState.OPEN, Instant.parse("2026-11-14T09:00:00Z"),
                "fix/module-scope", "main", "https://github.com/fixture/pull-request-test/pull/12");
        closed = pullRequest(13, "Closed without merge", "The proposal was closed without merging.",
                GitPullRequestState.CLOSED, Instant.parse("2026-11-13T09:00:00Z"),
                "draft/unused-change", "main", "https://github.com/fixture/pull-request-test/pull/13");

        TaskGitLink taskLink = new TaskGitLink();
        taskLink.setTask(task);
        taskLink.setPullRequest(merged);
        taskLink.setSource(TaskGitLinkSource.AUTO);
        taskLink.setLinkedAt(merged.getCreatedAt());
        links.saveAndFlush(taskLink);
        TaskGitLink otherTaskLink = new TaskGitLink();
        otherTaskLink.setTask(otherTask);
        otherTaskLink.setPullRequest(merged);
        otherTaskLink.setSource(TaskGitLinkSource.AUTO);
        otherTaskLink.setLinkedAt(merged.getCreatedAt());
        links.saveAndFlush(otherTaskLink);

        firstReview = review(merged, 90_001L + root.getId(), GitPullRequestReviewState.APPROVED,
                Instant.parse("2026-11-15T11:00:00Z"));
        review(merged, 90_002L + root.getId(), GitPullRequestReviewState.COMMENTED,
                Instant.parse("2026-11-15T12:00:00Z"));

        when(scopes.require(anyLong())).thenAnswer(invocation -> new GitActivityScope(null,
                root.getId(), Set.of(root.getId(), module.getId()), true, Set.of(), Map.of(), true));
    }

    @Test
    void pullRequestListSearchSortAndPageUseSourceFields() {
        var page = service.pullRequests(92L, "complete history", "oldest", 0, 1,
                null, null, null, null, null);

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent()).singleElement().satisfies(item -> {
            assertThat(item.number()).isEqualTo(11);
            assertThat(item.title()).isEqualTo("Improve activity filters");
            assertThat(item.authorName()).isEqualTo("PR Author");
            assertThat(item.state()).isEqualTo(GitPullRequestState.MERGED);
            assertThat(item.createdAt()).isEqualTo(merged.getCreatedAt());
            assertThat(item.htmlUrl()).isEqualTo(merged.getHtmlUrl());
        });
    }

    @Test
    void pullRequestDetailsIncludeTaskBranchesAndOrderedSubmittedReviews() {
        GitActivityDtos.PullRequestDetails details = service.pullRequest(92L, merged.getId());

        assertThat(details.body()).contains("Reduce query work");
        assertThat(details.sourceBranch()).isEqualTo("feature/activity-filters");
        assertThat(details.targetBranch()).isEqualTo("main");
        assertThat(details.tasks()).containsExactly(new GitActivityDtos.TaskLink(
                task.getId(), module.getId(), task.getTitle(), TaskGitLinkSource.AUTO));
        assertThat(details.reviews()).extracting(GitActivityDtos.PullRequestReview::state)
                .containsExactly(GitPullRequestReviewState.APPROVED, GitPullRequestReviewState.COMMENTED);
        assertThat(details.reviews()).extracting(GitActivityDtos.PullRequestReview::reviewerName)
                .containsOnly("PR Reviewer");
        assertThat(details.htmlUrl()).isEqualTo(merged.getHtmlUrl());
    }

    @Test
    void closedWithoutMergeStaysClosedAndSharedPullRequestIsDeduplicatedInRootScope() {
        var closedPage = service.pullRequests(92L, "closed without merge", "newest", 0, 20,
                null, null, null, null, null);
        assertThat(closedPage.getContent()).singleElement().satisfies(item -> {
            assertThat(item.state()).isEqualTo(GitPullRequestState.CLOSED);
            assertThat(item.mergedAt()).isNull();
            assertThat(item.htmlUrl()).isEqualTo(closed.getHtmlUrl());
        });

        when(scopes.require(92L)).thenReturn(new GitActivityScope(null, root.getId(),
                Set.of(root.getId(), module.getId(), otherModule.getId()), true, Set.of(), Map.of(), true));
        var rootPage = service.pullRequests(92L, null, "newest", 0, 2,
                null, null, null, null, null);
        assertThat(rootPage.getTotalElements()).isEqualTo(3);
        assertThat(rootPage.getContent()).filteredOn(item -> item.id().equals(merged.getId())).hasSize(1);
        assertThat(service.pullRequest(92L, merged.getId()).tasks())
                .extracting(GitActivityDtos.TaskLink::taskId)
                .containsExactly(task.getId(), otherTask.getId());
    }

    @Test
    void taskWithoutProjectReturnsNotFoundAndItsPullRequestLinkIsHidden() {
        SprintBacklog teamOnlyTask = new SprintBacklog();
        teamOnlyTask.setProjectId(null);
        teamOnlyTask.setTitle("Team-only work item");
        teamOnlyTask = tasks.saveAndFlush(teamOnlyTask);
        TaskGitLink invalidScopeLink = new TaskGitLink();
        invalidScopeLink.setTask(teamOnlyTask);
        invalidScopeLink.setPullRequest(merged);
        invalidScopeLink.setSource(TaskGitLinkSource.AUTO);
        invalidScopeLink.setLinkedAt(merged.getCreatedAt());
        links.saveAndFlush(invalidScopeLink);

        Long teamOnlyTaskId = teamOnlyTask.getId();
        assertThatThrownBy(() -> service.pullRequests(92L, null, "newest", 0, 20,
                null, teamOnlyTaskId, null, null, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(error -> assertThat(((ResponseStatusException) error).getStatusCode())
                        .isEqualTo(HttpStatus.NOT_FOUND));
        assertThat(service.pullRequest(92L, merged.getId()).tasks())
                .extracting(GitActivityDtos.TaskLink::taskId)
                .containsExactly(task.getId());
    }

    @Test
    void taskFilterReturnsOnlyPullRequestsLinkedToThatTask() {
        var page = service.pullRequests(92L, null, "newest", 0, 5,
                null, task.getId(), null, null, null);

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent()).extracting(GitActivityDtos.PullRequestItem::id)
                .containsExactly(merged.getId());
    }

    @Test
    void pullRequestHistoryRemainsVisibleAfterRepositoryUnlink() {
        repository.markInactive(Instant.parse("2026-11-16T10:00:00Z"));
        repositories.saveAndFlush(repository);

        var page = service.pullRequests(92L, null, "newest", 0, 20,
                null, null, null, null, null);
        var details = service.pullRequest(92L, merged.getId());

        assertThat(page.getTotalElements()).isEqualTo(3);
        assertThat(page.getContent()).extracting(GitActivityDtos.PullRequestItem::id)
                .containsExactly(merged.getId(), open.getId(), closed.getId());
        assertThat(details.title()).isEqualTo(merged.getTitle());
        assertThat(details.reviews()).hasSize(2);
    }

    @Test
    void pullRequestAnalyticsCountsStatusesAndAveragesOnlyValidMergedPullRequests() {
        GitPullRequest secondMerged = pullRequest(14, "Second merged PR", "Valid four hour merge.",
                GitPullRequestState.MERGED, Instant.parse("2026-11-15T10:00:00Z"),
                "feature/second-merged", "main", null);
        secondMerged.setMergedAt(secondMerged.getCreatedAt().plusSeconds(14_400));
        secondMerged.setClosedAt(secondMerged.getMergedAt());
        pullRequests.saveAndFlush(secondMerged);
        GitPullRequest thirdMerged = pullRequest(15, "Third merged PR", "Valid six hour merge.",
                GitPullRequestState.MERGED, Instant.parse("2026-11-15T11:00:00Z"),
                "feature/third-merged", "main", null);
        thirdMerged.setMergedAt(thirdMerged.getCreatedAt().plusSeconds(21_600));
        thirdMerged.setClosedAt(thirdMerged.getMergedAt());
        pullRequests.saveAndFlush(thirdMerged);
        GitPullRequest mergedWithoutTimestamp = pullRequest(16, "Missing merge timestamp", "Incomplete source row.",
                GitPullRequestState.MERGED, Instant.parse("2026-11-15T12:00:00Z"),
                "feature/incomplete", "main", null);
        mergedWithoutTimestamp.setMergedAt(null);
        mergedWithoutTimestamp.setClosedAt(null);
        pullRequests.saveAndFlush(mergedWithoutTimestamp);

        var analytics = service.pullRequestAnalytics(92L, null, null, null, null, null);

        assertThat(analytics.total()).isEqualTo(6);
        assertThat(analytics.open()).isEqualTo(1);
        assertThat(analytics.merged()).isEqualTo(4);
        assertThat(analytics.closedWithoutMerge()).isEqualTo(1);
        assertThat(analytics.averageMergeHours()).isEqualTo(4d);
        assertThat(analytics.medianMergeHours()).isEqualTo(4d);
        assertThat(analytics.developers()).singleElement().satisfies(row -> {
            assertThat(row.name()).isEqualTo("Unmapped Contributor");
            assertThat(row.total()).isEqualTo(6);
            assertThat(row.merged()).isEqualTo(4);
            assertThat(row.closedWithoutMerge()).isEqualTo(1);
        });
    }

    @Test
    void pullRequestAnalyticsFiltersByDeveloperAndCreationDateBeforeRecomputingMetrics() {
        User secondUser = User.builder()
                .email("git-pr-second-" + UUID.randomUUID() + "@example.test")
                .passwordHash("test-password-hash")
                .firstName("Second")
                .lastName("PR Author")
                .tenantId(root.getTenantId())
                .build();
        secondUser = users.saveAndFlush(secondUser);
        Long secondUserId = secondUser.getId();
        GitContributor secondAuthor = contributor(840_000L + root.getId(), "second-pr-author", "Second PR Author");
        secondAuthor.setUser(secondUser);
        contributors.saveAndFlush(secondAuthor);
        GitPullRequest secondAuthorPr = pullRequest(14, "Second author PR", "Created at the local day boundary.",
                GitPullRequestState.OPEN, Instant.parse("2026-11-14T17:00:00Z"),
                "feature/second-author", "main", null);
        secondAuthorPr.setAuthorContributor(secondAuthor);
        pullRequests.saveAndFlush(secondAuthorPr);
        GitPullRequest nextLocalDayPr = pullRequest(15, "Next local day PR", "Outside the selected date.",
                GitPullRequestState.CLOSED, Instant.parse("2026-11-15T17:00:00Z"),
                "feature/next-day", "main", null);

        var selectedDeveloper = service.pullRequestAnalytics(92L, null, null, secondUserId, null, null);
        assertThat(selectedDeveloper.total()).isEqualTo(1);
        assertThat(selectedDeveloper.open()).isEqualTo(1);
        assertThat(selectedDeveloper.developers()).singleElement().satisfies(row -> {
            assertThat(row.developerId()).isEqualTo(secondUserId);
            assertThat(row.name()).isEqualTo("Second PR Author");
        });

        var selectedDate = service.pullRequestAnalytics(92L, null, null, null,
                LocalDate.of(2026, 11, 15), LocalDate.of(2026, 11, 15));
        assertThat(selectedDate.total()).isEqualTo(2);
        assertThat(selectedDate.open()).isEqualTo(1);
        assertThat(selectedDate.closedWithoutMerge()).isEqualTo(0);
        assertThat(selectedDate.merged()).isEqualTo(1);
        assertThat(nextLocalDayPr.getCreatedAt()).isEqualTo(Instant.parse("2026-11-15T17:00:00Z"));
    }

    @Test
    void pullRequestAnalyticsReturnsEmptyMetricsWithoutInventingMergeDurations() {
        reviews.deleteAll();
        pullRequests.deleteAll();
        var empty = service.pullRequestAnalytics(92L, null, null, null, null, null);
        assertThat(empty.total()).isZero();
        assertThat(empty.open()).isZero();
        assertThat(empty.merged()).isZero();
        assertThat(empty.closedWithoutMerge()).isZero();
        assertThat(empty.averageMergeHours()).isNull();
        assertThat(empty.medianMergeHours()).isNull();
        assertThat(empty.developers()).isEmpty();
    }

    @Test
    void moduleScopeOnlyReturnsPullRequestsLinkedToItsTasks() {
        when(scopes.require(92L)).thenReturn(new GitActivityScope(null, root.getId(),
                Set.of(module.getId()), false, Set.of(), Map.of(), true));

        var page = service.pullRequests(92L, null, "newest", 0, 20,
                null, null, null, null, null);

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent()).extracting(GitActivityDtos.PullRequestItem::id).containsExactly(merged.getId());
        assertThatThrownBy(() -> service.pullRequest(92L, open.getId()))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void taskReadPermissionHidesTaskMetadataFromPullRequestDetails() {
        when(scopes.require(92L)).thenReturn(new GitActivityScope(null, root.getId(),
                Set.of(root.getId(), module.getId()), true, Set.of(), Map.of(), false));

        var details = service.pullRequest(92L, merged.getId());

        assertThat(details.tasks()).isEmpty();
        assertThat(details.reviews()).hasSize(2);
    }

    @Test
    void reviewSourceIdIsUniqueWithinPullRequest() {
        GitPullRequestReview duplicate = new GitPullRequestReview();
        duplicate.setPullRequest(merged);
        duplicate.setExternalId(firstReview.getExternalId());
        duplicate.setReviewerContributor(reviewer);
        duplicate.setState(GitPullRequestReviewState.DISMISSED);
        duplicate.setSubmittedAt(Instant.parse("2026-11-16T10:00:00Z"));
        duplicate.setSourceUpdatedAt(Instant.parse("2026-11-16T10:00:00Z"));
        duplicate.setSelfReview(false);
        assertThatThrownBy(() -> reviews.saveAndFlush(duplicate)).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void sourceUpdatesRejectOutOfOrderPrAndReviewSnapshots() {
        assertThat(merged.applySourceStatus(GitPullRequestState.CLOSED,
                Instant.parse("2026-11-14T09:00:00Z"), null, Instant.parse("2026-11-14T09:00:00Z"))).isFalse();
        assertThat(merged.getState()).isEqualTo(GitPullRequestState.MERGED);
        assertThat(firstReview.applySourceState(GitPullRequestReviewState.DISMISSED,
                Instant.parse("2026-11-15T12:30:00Z"), Instant.parse("2026-11-15T13:00:00Z"))).isTrue();
        assertThat(firstReview.applySourceState(GitPullRequestReviewState.APPROVED,
                Instant.parse("2026-11-15T11:15:00Z"), Instant.parse("2026-11-15T12:00:00Z"))).isFalse();
        assertThat(firstReview.getState()).isEqualTo(GitPullRequestReviewState.DISMISSED);
    }

    private Project project(String prefix, Tenant tenant, Project parent) {
        Project project = new Project();
        project.setCode(prefix + UUID.randomUUID());
        project.setName(prefix + "fixture");
        project.setTenant(tenant);
        project.setStatus(ProjectStatus.ACTIVE);
        project.setParentProject(parent);
        return projects.saveAndFlush(project);
    }

    private GitContributor contributor(Long externalId, String login, String displayName) {
        GitContributor contributor = new GitContributor();
        contributor.setRootProject(root);
        contributor.setExternalId(externalId);
        contributor.setLogin(login);
        contributor.setDisplayName(displayName);
        return contributors.saveAndFlush(contributor);
    }

    private GitPullRequest pullRequest(int number, String title, String body, GitPullRequestState state,
                                       Instant createdAt, String sourceBranch, String targetBranch, String htmlUrl) {
        GitPullRequest pr = new GitPullRequest();
        pr.setRepository(repository);
        pr.setNumber(number);
        pr.setExternalId(850_000L + root.getId() * 10 + number);
        pr.setTitle(title);
        pr.setBody(body);
        pr.setAuthorContributor(author);
        pr.setState(state);
        pr.setDraft(false);
        pr.setSourceBranch(sourceBranch);
        pr.setTargetBranch(targetBranch);
        pr.setHtmlUrl(htmlUrl);
        pr.setCreatedAt(createdAt);
        pr.setSourceUpdatedAt(createdAt.plusSeconds(60));
        pr.setMergedAt(state == GitPullRequestState.MERGED ? createdAt.plusSeconds(7_200) : null);
        pr.setClosedAt(state == GitPullRequestState.OPEN ? null : createdAt.plusSeconds(7_200));
        pr.setFirstReviewAt(state == GitPullRequestState.MERGED ? createdAt.plusSeconds(3_600) : null);
        return pullRequests.saveAndFlush(pr);
    }

    private GitPullRequestReview review(GitPullRequest pr, Long externalId,
                                        GitPullRequestReviewState state, Instant submittedAt) {
        GitPullRequestReview review = new GitPullRequestReview();
        review.setPullRequest(pr);
        review.setExternalId(externalId);
        review.setReviewerContributor(reviewer);
        review.setState(state);
        review.setSubmittedAt(submittedAt);
        review.setSourceUpdatedAt(submittedAt);
        review.setSelfReview(false);
        return reviews.saveAndFlush(review);
    }
}
