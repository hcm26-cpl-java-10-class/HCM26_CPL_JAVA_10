package com.example.starter_project_2025.system.project.task;

import java.util.UUID;

public interface TaskArtifactAccess {
    boolean hasArtifactOrReview(UUID taskId);
}
