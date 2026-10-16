package com.example.starter_project_2025.system.demo.progress;

import com.example.starter_project_2025.system.demo.lesson.LessonContentType;

import java.time.LocalDateTime;
import java.util.List;

public record LessonProgressDTO(
        Long enrollmentId,
        Long courseId,
        String courseName,
        int totalLessons,
        int completedLessons,
        int progressPercentage,
        Long lastLessonId,
        LocalDateTime lastAccessedAt,
        List<LessonItem> lessons
) {
    public record LessonItem(
            Long lessonId,
            Long sectionId,
            String sectionTitle,
            String title,
            LessonContentType contentType,
            String contentUrl,
            String textContent,
            Integer duration,
            Integer orderIndex,
            boolean completed,
            LocalDateTime completedAt,
            LocalDateTime lastAccessedAt
    ) {
    }
}
