package com.example.starter_project_2025.system.git_integration.dto;

import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobType;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncPhase;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * GI-04: a synchronization job as shown to users. SY-01 adds the step reached, the commit
 * import progress, whether a stopped job can resume from its cursor (the cursor itself is never
 * exposed) and, while waiting for the GitHub rate limit, when it resumes.
 */
public record GitSyncJobView(
        Long id,
        GitSyncJobType type,
        GitSyncJobStatus status,
        int attemptCount,
        int maxAttempts,
        LocalDateTime nextRunAt,
        LocalDateTime startedAt,
        LocalDateTime finishedAt,
        String errorCode,
        Map<String, Object> stats,
        GitSyncPhase phase,
        Progress progress,
        boolean resumable,
        LocalDateTime pausedUntil) {

    /**
     * Commit pages stored, and commits inserted / already stored / completed (all runs of the job).
     * SY-02: pull requests and reviews stored by the job.
     */
    public record Progress(int pages, long inserted, long existing, long enriched,
                           PullRequests pullRequests, Reviews reviews) {
    }

    public record PullRequests(int pages, long inserted, long updated, long unchanged) {
    }

    public record Reviews(long inserted, long updated) {
    }
}
