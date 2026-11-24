package com.example.starter_project_2025.system.git_integration.sync;

/**
 * SY-01 / SY-02: how one step of a run ended, the job as it is afterwards (a finished commit step
 * hands over a job in its pull request step) and how many pages of the run's budget it used.
 */
public record SyncStepResult(Outcome outcome, GitSyncJobStore.ClaimedJob job, int pages) {

    public enum Outcome {
        /** The step read its whole window (the job moved on, or succeeded after its last step). */
        DONE,
        /** This run used its share of pages: queued again to continue. */
        YIELDED,
        /** The GraphQL quota is low: queued again after the reset. */
        PAUSED,
        /** The installation can no longer read the repository. */
        REPOSITORY_LOST,
        /** GI-05: the connection was unlinked or disconnected while the step ran. */
        REPOSITORY_STOPPED
    }

    static SyncStepResult of(Outcome outcome, GitSyncJobStore.ClaimedJob job, int pages) {
        return new SyncStepResult(outcome, job, pages);
    }
}
