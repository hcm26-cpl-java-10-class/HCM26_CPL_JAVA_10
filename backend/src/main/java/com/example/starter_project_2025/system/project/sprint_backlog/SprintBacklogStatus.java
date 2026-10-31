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
    BLOCKED("Blocked"),
    // Workspace-configured statuses use stable persisted keys while their
    // display names remain workspace-specific in boardColumnsConfig.
    CUSTOM_1("Custom 1"),
    CUSTOM_2("Custom 2"),
    CUSTOM_3("Custom 3"),
    CUSTOM_4("Custom 4"),
    CUSTOM_5("Custom 5");

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

    public boolean isCustom() {
        return name().startsWith("CUSTOM_");
    }
}
