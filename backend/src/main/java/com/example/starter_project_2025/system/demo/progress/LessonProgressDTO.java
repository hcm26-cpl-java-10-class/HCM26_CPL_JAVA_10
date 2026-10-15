package com.example.starter_project_2025.system.demo.progress;

import java.time.LocalDateTime;

public record LessonProgressDTO(
        Long id,
        Long enrollmentId,
        Long lessonId,
        boolean isCompleted,
        LocalDateTime completedAt,
        LocalDateTime lastAccessedAt
) {
    static LessonProgressDTO from(LessonProgress progress) {
        return new LessonProgressDTO(
                progress.getId(),
                progress.getEnrollment().getId(),
                progress.getLessonId(),
                progress.isCompleted(),
                progress.getCompletedAt(),
                progress.getLastAccessedAt()
        );
    }
}
