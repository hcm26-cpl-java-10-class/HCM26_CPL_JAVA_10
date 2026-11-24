package com.example.starter_project_2025.system.project.developmentinsights.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.example.starter_project_2025.system.project.developmentinsights.domain.*;
import com.example.starter_project_2025.system.project.developmentinsights.dto.GitActivityDtos;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestReviewRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.rbac.user.User;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class GitReviewAnalyticsServiceTest {
    private GitActivityScopeService scopes;
    private GitPullRequestRepository pullRequests;
    private GitPullRequestReviewRepository reviews;
    private GitReviewAnalyticsService service;
    private GitPullRequest request;
    private GitContributor reviewer;
    private List<GitPullRequestReview> source;

    @BeforeEach
    void setUp() {
        scopes = mock(GitActivityScopeService.class);
        pullRequests = mock(GitPullRequestRepository.class);
        reviews = mock(GitPullRequestReviewRepository.class);
        service = new GitReviewAnalyticsService(scopes, pullRequests, reviews);
        Project root = mock(Project.class);
        when(root.getId()).thenReturn(10L);
        User user = mock(User.class);
        when(user.getId()).thenReturn(101L);
        reviewer = mock(GitContributor.class);
        when(reviewer.getId()).thenReturn(201L);
        when(reviewer.getUser()).thenReturn(user);
        when(reviewer.label()).thenReturn("Reviewer One");
        when(reviewer.getLogin()).thenReturn("reviewer-one");

        GitContributor author = mock(GitContributor.class);
        when(author.getId()).thenReturn(202L);
        GitRepository repository = mock(GitRepository.class);
        when(repository.getId()).thenReturn(4L);
        request = request(100L, 800L);
        when(request.getRepository()).thenReturn(repository);
        when(request.getExternalId()).thenReturn(800L);
        when(request.getNumber()).thenReturn(44);
        when(request.getTitle()).thenReturn("Improve task links");
        when(request.getState()).thenReturn(GitPullRequestState.MERGED);
        when(request.getAuthorContributor()).thenReturn(author);
        when(request.getCreatedAt()).thenReturn(Instant.parse("2026-11-19T10:00:00Z"));
        when(request.getHtmlUrl()).thenReturn("https://github.com/example/repo/pull/44");
        when(pullRequests.findVisibleForAnalytics(eq(10L), anyBoolean(), anyCollection(), anyCollection(),
                anyCollection(), isNull(), isNull(), isNull(), any(), isNull()))
                .thenReturn(List.of(request));

        source = List.of(
                review(1L, reviewer, GitPullRequestReviewState.DISMISSED, "2026-11-19T11:00:00Z", false),
                review(2L, reviewer, GitPullRequestReviewState.APPROVED, "2026-11-19T12:00:00Z", false),
                review(3L, reviewer, GitPullRequestReviewState.CHANGES_REQUESTED, "2026-11-19T14:00:00Z", false),
                review(4L, reviewer, GitPullRequestReviewState.APPROVED, "2026-11-19T16:00:00Z", true));
        when(reviews.findAllByPullRequest_IdOrderBySubmittedAtAscIdAsc(100L)).thenReturn(source);
        GitActivityScope scope = new GitActivityScope(null, 10L, Set.of(10L), true, Set.of(),
                Map.of(), true, List.of(
                new GitActivityScope.MemberIdentity(101L, "Reviewer One", "reviewer-one", Set.of(10L)),
                new GitActivityScope.MemberIdentity(999L, "No Review Activity", "no-review", Set.of(10L))));
        when(scopes.require(3L)).thenReturn(scope);
    }

    @Test
    void countsOnlySubmittedNonDismissedNonSelfReviewsAndFindsFirstResponse() {
        var report = service.report(3L, null, null, null, null);

        assertThat(report.totalReviews()).isEqualTo(2);
        assertThat(report.approved()).isEqualTo(1);
        assertThat(report.changesRequested()).isEqualTo(1);
        assertThat(report.commented()).isZero();
        assertThat(report.reviewedPullRequests()).isEqualTo(1);
        assertThat(report.medianFirstResponseHours()).isEqualTo(2d);
        assertThat(report.reviewers()).singleElement().satisfies(row -> {
            assertThat(row.developerId()).isEqualTo(101L);
            assertThat(row.reviews()).isEqualTo(2);
            assertThat(row.pullRequests()).singleElement().satisfies(pr -> {
                assertThat(pr.number()).isEqualTo(44);
                assertThat(pr.responseHours()).isEqualTo(2d);
            });
        });
    }

    @Test
    void reviewerAndSubmittedDateFiltersApplyAcrossTheWholeVisibleSet() {
        var oneReviewer = service.report(3L, null, 101L, LocalDate.parse("2026-11-19"), LocalDate.parse("2026-11-19"));
        var otherReviewer = service.report(3L, null, 999L, null, null);

        assertThat(oneReviewer.totalReviews()).isEqualTo(2);
        assertThat(otherReviewer.totalReviews()).isZero();
        assertThat(otherReviewer.reviewers()).isEmpty();
    }

    @Test
    void dateFilterKeepsThePrsFirstValidResponseTimestamp() {
        source = List.of(
                review(6L, reviewer, GitPullRequestReviewState.APPROVED, "2026-11-19T12:00:00Z", false),
                review(7L, reviewer, GitPullRequestReviewState.COMMENTED, "2026-11-20T14:00:00Z", false));
        when(reviews.findAllByPullRequest_IdOrderBySubmittedAtAscIdAsc(100L)).thenReturn(source);

        var report = service.report(3L, null, 101L, LocalDate.parse("2026-11-20"), LocalDate.parse("2026-11-20"));

        assertThat(report.totalReviews()).isEqualTo(1);
        assertThat(report.reviewedPullRequests()).isEqualTo(1);
        assertThat(report.averageFirstResponseHours()).isEqualTo(2d);
        assertThat(report.reviewers()).singleElement().satisfies(row ->
                assertThat(row.pullRequests()).singleElement().satisfies(pr -> {
                    assertThat(pr.firstReviewAt()).isEqualTo(Instant.parse("2026-11-19T12:00:00Z"));
                    assertThat(pr.responseHours()).isEqualTo(2d);
                }));
    }

    @Test
    void workspaceModuleScopeIncludesVisibleReviewersAndSelectedProjectExcludesSiblings() {
        User siblingUser = mock(User.class);
        when(siblingUser.getId()).thenReturn(999L);
        GitContributor siblingReviewer = mock(GitContributor.class);
        when(siblingReviewer.getId()).thenReturn(302L);
        when(siblingReviewer.getUser()).thenReturn(siblingUser);
        when(siblingReviewer.label()).thenReturn("Sibling reviewer");
        source = List.of(source.get(1), review(5L, siblingReviewer,
                GitPullRequestReviewState.COMMENTED, "2026-11-19T13:00:00Z", false));
        var moduleScope = new GitActivityScope(null, 10L, Set.of(10L, 11L), false,
                Set.of(201L, 302L), Map.of(10L, Set.of(201L), 11L, Set.of(302L)), true,
                List.of(
                        new GitActivityScope.MemberIdentity(101L, "Reviewer One", "reviewer-one", Set.of(10L)),
                        new GitActivityScope.MemberIdentity(999L, "Sibling reviewer", "sibling", Set.of(11L))));
        when(scopes.require(3L)).thenReturn(moduleScope);
        when(reviews.findAllByPullRequest_IdOrderBySubmittedAtAscIdAsc(100L)).thenReturn(source);

        var workspaceReport = service.report(3L, null, null, null, null);
        var moduleReport = service.report(3L, 10L, null, null, null);

        assertThat(workspaceReport.totalReviews()).isEqualTo(2);
        assertThat(workspaceReport.reviewers()).extracting(GitActivityDtos.ReviewerActivity::contributorId)
                .containsExactlyInAnyOrder(201L, 302L);
        assertThat(moduleReport.totalReviews()).isEqualTo(1);
        assertThat(moduleReport.reviewers()).singleElement().satisfies(row -> {
            assertThat(row.developerId()).isEqualTo(101L);
            assertThat(row.name()).isEqualTo("Reviewer One");
        });
    }

    private GitPullRequest request(Long id, Long externalId) {
        GitPullRequest value = mock(GitPullRequest.class);
        when(value.getId()).thenReturn(id);
        when(value.getExternalId()).thenReturn(externalId);
        return value;
    }

    private GitPullRequestReview review(Long id, GitContributor contributor, GitPullRequestReviewState state,
                                        String submittedAt, boolean selfReview) {
        GitPullRequestReview review = mock(GitPullRequestReview.class);
        when(review.getId()).thenReturn(id);
        when(review.getReviewerContributor()).thenReturn(contributor);
        when(review.getState()).thenReturn(state);
        when(review.getSubmittedAt()).thenReturn(Instant.parse(submittedAt));
        when(review.isSelfReview()).thenReturn(selfReview);
        return review;
    }
}
