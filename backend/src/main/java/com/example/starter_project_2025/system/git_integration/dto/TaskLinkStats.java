package com.example.starter_project_2025.system.git_integration.dto;

/**
 * SY-05: how well commits and pull requests of a project's repository reference tasks.
 * A source is counted once per verdict it has (a commit naming a valid and an unknown
 * task counts in {@code linked} and in {@code invalid}).
 */
public record TaskLinkStats(
        Counts commits,
        Counts pullRequests,
        long tasksWithCommits,
        long inProgressTasksWithoutCommits) {

    public record Counts(long total, long processed, long linked, long missing, long invalid, long outsideProject) {
        public static final Counts NONE = new Counts(0, 0, 0, 0, 0, 0);
    }

    public static TaskLinkStats none() {
        return new TaskLinkStats(Counts.NONE, Counts.NONE, 0, 0);
    }
}
