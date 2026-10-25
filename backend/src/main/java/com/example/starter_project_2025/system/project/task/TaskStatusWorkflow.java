package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.project.sprint.TaskStatus;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

@Component
public class TaskStatusWorkflow {

    private static final Map<TaskStatus, Set<TaskStatus>> TRANSITIONS = Map.of(
            TaskStatus.TODO, Set.of(TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED),
            TaskStatus.IN_PROGRESS, Set.of(TaskStatus.REVIEW, TaskStatus.BLOCKED, TaskStatus.TODO),
            TaskStatus.REVIEW, Set.of(TaskStatus.DONE, TaskStatus.BLOCKED, TaskStatus.IN_PROGRESS),
            TaskStatus.BLOCKED, Set.of(TaskStatus.TODO, TaskStatus.IN_PROGRESS),
            TaskStatus.DONE, Set.of(TaskStatus.IN_PROGRESS)
    );

    public boolean allows(TaskStatus current, TaskStatus requested) {
        return TRANSITIONS.getOrDefault(current, Set.of()).contains(requested);
    }
}
