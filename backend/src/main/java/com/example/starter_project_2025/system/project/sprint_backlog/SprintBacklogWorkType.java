package com.example.starter_project_2025.system.project.sprint_backlog;

/**
 * Work type of a Sprint Backlog item: {@code Story}, {@code Bug} or
 * {@code Task}.
 * <p>
 * The list is FIXED on purpose: users pick one of these values when they create
 * a work item, there is no "work type management" screen and no endpoint to add
 * new types. Adding a value is a code change (plus a UI icon entry).
 * <p>
 * The enum names are the values exchanged with the API / stored in the
 * {@code work_type} column, while {@link #getLabel()} is the human readable text
 * shown on the UI.
 */
public enum SprintBacklogWorkType {

    STORY("Story"),
    BUG("Bug"),
    TASK("Task");

    /** Type used when a create request does not send one. */
    public static final SprintBacklogWorkType DEFAULT = TASK;

    private final String label;

    SprintBacklogWorkType(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
