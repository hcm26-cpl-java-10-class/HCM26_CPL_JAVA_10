package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.system.demo.course.CourseLevel;

public record CatalogCourseDTO(
        Long id,
        String name,
        String description,
        String thumbnailUrl,
        String instructor,
        Long categoryId,
        String categoryName,
        CourseLevel level,
        long lessonCount,
        long totalDuration,
        boolean isFree,
        boolean enrolled
) {
}
