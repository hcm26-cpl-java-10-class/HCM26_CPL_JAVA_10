package com.example.starter_project_2025.system.project.backlog_temp;

/**
 * Lifecycle of a backlog item, as required by UFR-PRJ-003-02:
 * {@code Backlog -> Sprint Backlog -> In Progress -> Done}.
 * <p>
 * A backlog item only moves forward, one stage at a time. Any other change
 * (skipping a stage or moving backwards) is rejected with HTTP 422 so the
 * workflow cannot be bypassed from the UI.
 */
public enum TaskStatus {

    BACKLOG("Backlog"),
    SPRINT_BACKLOG("Sprint Backlog"),
    IN_PROGRESS("In Progress"),
    DONE("Done");

    private final String label;

    TaskStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    /**
     * @return {@code true} when a new item may be created with this status: a
     *         new item starts in the product backlog, or directly in a sprint
     *         backlog when a sprint is selected.
     */
    public boolean isInitialStage() {
        return this == BACKLOG || this == SPRINT_BACKLOG;
    }

    /**
     * @return {@code true} when moving from this status to {@code target} is
     *         allowed. Keeping the current status is always allowed.
     */
    public boolean canTransitionTo(TaskStatus target) {

        if (target == null || target == this) {
            return true;
        }

        return switch (this) {
            case BACKLOG -> target == SPRINT_BACKLOG;
            case SPRINT_BACKLOG -> target == IN_PROGRESS;
            case IN_PROGRESS -> target == DONE;
            case DONE -> false;
        };
    }

    /**
     * Human readable workflow, used in the validation message shown on the UI.
     */
    public static String workflow() {
        return "Backlog → Sprint Backlog → In Progress → Done";
    }
}
