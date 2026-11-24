package com.example.starter_project_2025.system.project.developmentinsights.service;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitContributor;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequest;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestReview;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestReviewState;
import com.example.starter_project_2025.system.project.developmentinsights.dto.GitActivityDtos;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestReviewRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/** Review analytics from submitted GitHub review snapshots only. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GitReviewAnalyticsService {
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final GitActivityScopeService scopes;
    private final GitPullRequestRepository pullRequests;
    private final GitPullRequestReviewRepository reviews;

    public GitActivityDtos.CodeReviewAnalytics report(Long workspaceId, Long projectId,
                                                       Long developerId, LocalDate from, LocalDate to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start date must not be after end date");
        }
        GitActivityScope scope = scopes.require(workspaceId);
        if (projectId != null && !scope.projectIds().contains(projectId)) {
            throw new AccessDeniedException("The selected Project is outside the current Workspace scope");
        }
        if (developerId != null && scope.membersFor(projectId).stream()
                .noneMatch(member -> developerId.equals(member.userId()))) {
            throw new AccessDeniedException("The selected reviewer is outside the current Workspace scope");
        }
        Instant fromTime = from == null ? null : from.atStartOfDay(BUSINESS_ZONE).toInstant();
        Instant untilTime = to == null ? null : to.plusDays(1).atStartOfDay(BUSINESS_ZONE).toInstant();
        List<Long> projectContributors = projectId == null ? List.of(-1L) : scope.contributorsFor(projectId);
        Set<Long> allowedReviewers = projectId == null ? scope.contributorIds() : Set.copyOf(projectContributors);
        List<GitPullRequest> visible = pullRequests.findVisibleForAnalytics(scope.rootProjectId(), scope.rootScope(),
                scope.projectList(), scope.contributorList(), projectContributors, null, null,
                null, projectId, null);
        Map<ReviewKey, GitPullRequest> unique = new LinkedHashMap<>();
        for (GitPullRequest request : visible) {
            unique.putIfAbsent(new ReviewKey(request.getRepository().getId(), request.getExternalId()), request);
        }

        Map<String, ReviewerAccumulator> reviewers = new HashMap<>();
        List<Double> responseTimes = new ArrayList<>();
        long total = 0;
        long approved = 0;
        long changesRequested = 0;
        long commented = 0;
        long reviewedPullRequests = 0;
        for (GitPullRequest request : unique.values()) {
            if (request.getId() == null) continue;
            List<EligibleReview> eligible = reviews.findAllByPullRequest_IdOrderBySubmittedAtAscIdAsc(request.getId()).stream()
                    .filter(review -> eligible(scope, allowedReviewers, review, developerId, fromTime, untilTime))
                    .map(EligibleReview::new)
                    .toList();
            if (eligible.isEmpty()) continue;
            total += eligible.size();
            approved += eligible.stream().filter(value -> value.review().getState() == GitPullRequestReviewState.APPROVED).count();
            changesRequested += eligible.stream().filter(value -> value.review().getState() == GitPullRequestReviewState.CHANGES_REQUESTED).count();
            commented += eligible.stream().filter(value -> value.review().getState() == GitPullRequestReviewState.COMMENTED).count();

            List<GitPullRequestReview> chronological = reviews.findAllByPullRequest_IdOrderBySubmittedAtAscIdAsc(request.getId()).stream()
                    .filter(review -> eligible(scope, allowedReviewers, review, null, null, null))
                    .filter(review -> review.getSubmittedAt() != null && request.getCreatedAt() != null
                            && !review.getSubmittedAt().isBefore(request.getCreatedAt()))
                    .toList();
            if (!chronological.isEmpty()) {
                GitPullRequestReview first = chronological.get(0);
                responseTimes.add((double) Duration.between(request.getCreatedAt(), first.getSubmittedAt()).toMillis()
                        / 3_600_000d);
                reviewedPullRequests++;
            }

            Map<String, List<GitPullRequestReview>> perReviewer = new LinkedHashMap<>();
            for (EligibleReview item : eligible) {
                GitPullRequestReview review = item.review();
                GitContributor contributor = review.getReviewerContributor();
                if (contributor == null) continue;
                Long userId = contributor.getUser() == null ? null : contributor.getUser().getId();
                String key = userId == null ? "contributor:" + contributor.getId() : "developer:" + userId;
                perReviewer.computeIfAbsent(key, ignored -> new ArrayList<>()).add(review);
            }
            perReviewer.forEach((key, selectedReviews) -> {
                GitContributor contributor = selectedReviews.get(0).getReviewerContributor();
                Long mappedUserId = contributor.getUser() == null ? null : contributor.getUser().getId();
                GitPullRequestReview first = chronological.stream()
                        .filter(review -> Objects.equals(review.getReviewerContributor().getId(), contributor.getId()))
                        .findFirst().orElse(null);
                Double responseHours = first == null ? null
                        : (double) Duration.between(request.getCreatedAt(), first.getSubmittedAt()).toMillis() / 3_600_000d;
                var prRow = new GitActivityDtos.ReviewedPullRequest(request.getId(), request.getNumber(),
                        request.getTitle(), request.getState() == null ? null : request.getState().name(),
                        request.getCreatedAt(), first == null ? null : first.getSubmittedAt(), responseHours, request.getHtmlUrl());
                reviewers.computeIfAbsent(key, ignored -> new ReviewerAccumulator(
                                mappedUserId, contributor.getId(), contributor.label(), contributor.getLogin()))
                        .add(selectedReviews, prRow);
            });
        }
        List<GitActivityDtos.ReviewerActivity> rows = reviewers.values().stream()
                .map(ReviewerAccumulator::toView)
                .sorted(Comparator.comparingLong(GitActivityDtos.ReviewerActivity::reviews).reversed()
                        .thenComparing(GitActivityDtos.ReviewerActivity::name,
                                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
        responseTimes.sort(Double::compareTo);
        Double average = responseTimes.isEmpty() ? null : responseTimes.stream().mapToDouble(Double::doubleValue).average().orElseThrow();
        Double median = responseTimes.isEmpty() ? null : median(responseTimes);
        return new GitActivityDtos.CodeReviewAnalytics(total, approved, changesRequested, commented,
                reviewedPullRequests, average, median, rows);
    }

    private static boolean eligible(GitActivityScope scope, Set<Long> allowedReviewers,
                                    GitPullRequestReview review, Long developerId, Instant from, Instant until) {
        if (review == null || review.isSelfReview() || review.getSubmittedAt() == null
                || review.getState() == null || review.getState() == GitPullRequestReviewState.PENDING
                || review.getState() == GitPullRequestReviewState.DISMISSED) return false;
        GitContributor reviewer = review.getReviewerContributor();
        if (reviewer == null || !scope.rootScope() && !allowedReviewers.contains(reviewer.getId())) return false;
        if (developerId != null && (reviewer.getUser() == null
                || !Objects.equals(reviewer.getUser().getId(), developerId))) return false;
        return (from == null || !review.getSubmittedAt().isBefore(from))
                && (until == null || review.getSubmittedAt().isBefore(until));
    }

    private static double median(List<Double> values) {
        int middle = values.size() / 2;
        return values.size() % 2 == 1 ? values.get(middle)
                : (values.get(middle - 1) + values.get(middle)) / 2d;
    }

    private record EligibleReview(GitPullRequestReview review) { }
    private record ReviewKey(Long repositoryId, Long externalId) { }

    private static final class ReviewerAccumulator {
        private final Long developerId;
        private final Long contributorId;
        private final String name;
        private final String login;
        private final List<GitActivityDtos.ReviewedPullRequest> pullRequests = new ArrayList<>();
        private long reviews;
        private long approved;
        private long changesRequested;
        private long commented;

        private ReviewerAccumulator(Long developerId, Long contributorId, String name, String login) {
            this.developerId = developerId;
            this.contributorId = contributorId;
            this.name = name;
            this.login = login;
        }

        private void add(List<GitPullRequestReview> selected, GitActivityDtos.ReviewedPullRequest pullRequest) {
            reviews += selected.size();
            approved += selected.stream().filter(review -> review.getState() == GitPullRequestReviewState.APPROVED).count();
            changesRequested += selected.stream().filter(review -> review.getState() == GitPullRequestReviewState.CHANGES_REQUESTED).count();
            commented += selected.stream().filter(review -> review.getState() == GitPullRequestReviewState.COMMENTED).count();
            pullRequests.add(pullRequest);
        }

        private GitActivityDtos.ReviewerActivity toView() {
            return new GitActivityDtos.ReviewerActivity(developerId, contributorId, name, login, reviews,
                    approved, changesRequested, commented, List.copyOf(pullRequests));
        }
    }
}
