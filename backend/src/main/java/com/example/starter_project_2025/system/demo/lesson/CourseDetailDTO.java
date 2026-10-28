package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.system.demo.course.CourseLevel;

import java.util.List;

/**
 * Chi tiết khóa học kèm Section/Lesson.
 * If content is locked, contentUrl and textContent are null for every lesson.
 */
public record CourseDetailDTO(
        Long id,
        String name,
        String description,
        String thumbnailUrl,
        String instructor,
        Long categoryId,
        String categoryName,
        List<String> categoryNames,
        CourseLevel level,
        boolean isFree,
        boolean enrolled,
        boolean contentUnlocked,
        int lessonCount,
        long totalDuration,
        List<SectionItem> sections
) {

    public record SectionItem(
            Long id,
            String title,
            Integer orderIndex,
            List<LessonItem> lessons
    ) {
    }

    public record LessonItem(
            Long id,
            String title,
            LessonContentType contentType,
            Integer duration,
            Integer orderIndex,
            boolean locked,
            String contentUrl,
            String textContent
    ) {
    }
}
