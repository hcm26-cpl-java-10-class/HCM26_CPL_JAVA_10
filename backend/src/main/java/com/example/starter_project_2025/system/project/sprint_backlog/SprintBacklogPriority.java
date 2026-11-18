package com.example.starter_project_2025.system.project.sprint_backlog;

/**
 * Priority of a Sprint Backlog item: {@code Low -> Medium -> High -> Urgent}.
 * <p>
 * The enum names are the values exchanged with the API / stored in the
 * {@code priority} column, while {@link #getLabel()} is the human readable text
 * shown on the UI.
 */
public enum SprintBacklogPriority {

    LOW("Low"),
    MEDIUM("Medium"),
    HIGH("High"),
    URGENT("Urgent");

    private final String label;

    SprintBacklogPriority(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
