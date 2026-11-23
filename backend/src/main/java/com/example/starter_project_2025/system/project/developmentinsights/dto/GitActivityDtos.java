package com.example.starter_project_2025.system.project.developmentinsights.dto;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitSyncStatus;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestReviewState;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestState;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLinkSource;
import java.util.List;
import java.time.Instant;
import java.time.LocalDate;

public final class GitActivityDtos {
    private GitActivityDtos() { }

    public record RepositoryStatus(Long rootProjectId, boolean connected, String repositoryName,
                                   String repositoryUrl, GitRepositoryStatus status,
                                   GitSyncStatus syncStatus, Instant lastSyncedAt,
                                   boolean mockData) { }

    public record FilterProject(Long id, String name) { }

    public record FilterDeveloper(Long id, String name, String login) { }

    public record FilterOptions(List<FilterProject> projects, List<FilterDeveloper> developers) { }

    public record CommitTrendPoint(String key, String label, LocalDate startDate,
                                   LocalDate endDate, long commits) { }

    public record CommitDeveloperBreakdown(Long developerId, Long contributorId,
                                           String name, String login, boolean unmapped,
                                           boolean bot, long commits) { }

    public record CommitBranchBreakdown(String branch, String label, long commits) { }

    public record CommitAnalytics(long totalCommits, String granularity,
                                  List<CommitTrendPoint> trend,
                                  List<CommitDeveloperBreakdown> developers,
                                  List<CommitBranchBreakdown> branches,
                                  List<String> branchOptions,
                                  long unmappedContributorCommits) { }

    public record PullRequestDeveloperBreakdown(Long developerId, Long contributorId,
                                                 String name, String login, boolean unmapped,
                                                 long total, long open, long merged,
                                                 long closedWithoutMerge) { }

    public record PullRequestAnalytics(long total, long open, long merged,
                                       long closedWithoutMerge, Double averageMergeHours,
                                       Double medianMergeHours,
                                       List<PullRequestDeveloperBreakdown> developers) { }

    public record ReviewedPullRequest(Long id, Integer number, String title, String state,
                                      Instant createdAt, Instant firstReviewAt, Double responseHours,
                                      String htmlUrl) { }

    public record ReviewerActivity(Long developerId, Long contributorId, String name, String login,
                                   long reviews, long approved, long changesRequested, long commented,
                                   List<ReviewedPullRequest> pullRequests) { }

    public record CodeReviewAnalytics(long totalReviews, long approved, long changesRequested,
                                      long commented, long reviewedPullRequests,
                                      Double averageFirstResponseHours, Double medianFirstResponseHours,
                                      List<ReviewerActivity> reviewers) { }

    public record DeveloperActivityRow(Long developerId, Long contributorId,
                                       String name, String login, boolean unmapped,
                                       boolean noActivity, long commits, long pullRequests,
                                       long mergedPullRequests, long activeDays,
                                       Instant lastActiveAt) { }

    public record DeveloperActivity(List<DeveloperActivityRow> developers,
                                    long totalCommits, long totalPullRequests,
                                    long mergedPullRequests) { }

    public record SprintOption(Long id, Long projectId, String name,
                               java.time.LocalDateTime startDate,
                               java.time.LocalDateTime endDate) { }

    public record ReportOptions(List<FilterProject> projects, List<SprintOption> sprints,
                                List<FilterDeveloper> developers) { }

    public record GitActivitySummary(long totalCommits, long totalPullRequests,
                                     long mergedPullRequests, long openPullRequests,
                                     long closedWithoutMergePullRequests) { }

    public record SprintOverview(Long sprintId, String name, java.time.LocalDateTime startDate,
                                 java.time.LocalDateTime endDate, long totalTasks,
                                 long todoTasks, long inProgressTasks, long reviewTasks,
                                 long doneTasks, long unfinishedTasks) { }

    public record TaskTraceability(long tasksWithCommits, long tasksWithPullRequests,
                                   long tasksWithoutGitActivity, long unmappedCommits,
                                   long unmappedPullRequests) { }

    public record SprintDevelopmentReport(SprintOverview sprintOverview,
                                          GitActivitySummary gitActivity,
                                          TaskTraceability taskTraceability,
                                          List<DeveloperActivityRow> developerActivity,
                                          boolean repositoryConfigured,
                                          boolean mockData) { }

    public record ProjectDevelopmentReport(Long rootProjectId, Long projectId,
                                           String projectName, String repositoryName,
                                           String repositoryUrl, boolean repositoryConfigured,
                                           boolean mockData, long totalTasks,
                                           long todoTasks, long inProgressTasks,
                                           long reviewTasks, long doneTasks,
                                           GitActivitySummary gitActivity,
                                           TaskTraceability taskTraceability,
                                           List<DeveloperActivityRow> developerActivity) { }

    public record TaskContext(Long taskId, Long projectId, String projectName, String title, String status) { }

    public record TaskLink(Long taskId, Long projectId, String title, TaskGitLinkSource source) { }

    public record CommitItem(Long id, String sha, String shortSha, String message,
                             String authorName, String authorLogin, Instant committedAt,
                             String branch, String htmlUrl, List<TaskLink> tasks) { }

    public record CommitDetails(Long id, String sha, String message, String authorName,
                                String authorLogin, Instant committedAt, String branch,
                                String htmlUrl, String repositoryName, String repositoryUrl,
                                List<TaskLink> tasks) { }

    public record PullRequestReview(Long id, Long externalId, String reviewerName, String reviewerLogin,
                                    GitPullRequestReviewState state, Instant submittedAt,
                                    boolean selfReview) { }

    public record PullRequestItem(Long id, Integer number, String title, String authorName,
                                  String authorLogin, GitPullRequestState state, boolean draft,
                                  Instant createdAt, Instant mergedAt, String htmlUrl,
                                  List<TaskLink> tasks) { }

    public record PullRequestDetails(Long id, Integer number, String title, String body,
                                     String authorName, String authorLogin, String sourceBranch,
                                     String targetBranch, GitPullRequestState state, boolean draft,
                                     Instant createdAt, Instant mergedAt, Instant closedAt,
                                     String htmlUrl, String repositoryName, List<TaskLink> tasks,
                                     List<PullRequestReview> reviews) { }
}
