package com.example.starter_project_2025.system.project.backlog_temp;

import lombok.Getter;

import java.util.List;
import java.util.Map;

/**
 * Raised when the milestone selected for a backlog item does not exist any
 * more, was cancelled, or belongs to another project
 * (UFR-PRJ-003-02, AC03).
 * <p>
 * Translated into {@code 404 Not Found} by {@link TaskController}. The message
 * is the exact wording expected by the acceptance criteria, and it is also
 * attached to the {@code milestoneId} field so the UI can highlight the
 * selector and keep the rest of the form untouched.
 */
@Getter
public class TaskMilestoneNotFoundException extends RuntimeException {

    public static final String MESSAGE = "Milestone không tồn tại hoặc đã bị thay đổi";

    public static final String MILESTONE_FIELD = "milestoneId";

    private final Map<String, List<String>> errors;

    public TaskMilestoneNotFoundException() {
        super(MESSAGE);
        this.errors = Map.of(MILESTONE_FIELD, List.of(MESSAGE));
    }
}
