package com.example.starter_project_2025.system.project.sprint_backlog;

/**
 * Lifecycle of a Sprint Backlog item: {@code To do -> In progress -> Review -> Done}.
 * <p>
 * The enum names are the values exchanged with the API / stored in the
 * {@code status} column, while {@link #getLabel()} is the human readable text
 * shown on the UI.
 */
public enum SprintBacklogStatus {

    TODO("To do"),
    IN_PROGRESS("In progress"),
    REVIEW("Review"),
    DONE("Done"),
    BLOCKED("Blocked");

    private final String label;

    SprintBacklogStatus(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }

    /**
     * @return {@code true} when the item counts as finished from a reporting
     *         point of view.
     */
    public boolean isCompleted() {
        return this == DONE;
    }
}
