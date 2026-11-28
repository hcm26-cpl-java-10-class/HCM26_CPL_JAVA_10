package com.example.starter_project_2025.system.demo.learningpath;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

public final class LearningPathDTO {

    private LearningPathDTO() {
    }

    public record PathRequest(
            @NotBlank @Size(max = 150) String name,
            @Size(max = 2000) String description
    ) {
    }

    /** Ordered course ids; the position in the list becomes the position in the path. */
    public record SetCoursesRequest(@NotNull List<Long> courseIds) {
    }

    public record PathSummary(
            Long id, String name, String description,
            int courseCount, int completedCount, int progressPercent, boolean completed
    ) {
    }

    /** status = COMPLETED | IN_PROGRESS | AVAILABLE | LOCKED (see PathProgressLogic). */
    public record PathCourseItem(
            Long courseId, String courseName, int position, String status, List<String> missingPrerequisites
    ) {
    }

    public record PathDetail(
            Long id, String name, String description,
            List<PathCourseItem> courses,
            int completedCount, int progressPercent, boolean completed,
            String completionCode, LocalDateTime completedAt
    ) {
    }
}
