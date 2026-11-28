package com.example.starter_project_2025.system.demo.lesson;

import java.util.List;

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
        boolean enrolled,
        double averageRating,
        long totalReviews,
        List<String> categoryNames
) {
    public CatalogCourseDTO(Long id, String name, String description, String thumbnailUrl,
                            String instructor, Long categoryId, String categoryName, CourseLevel level,
                            long lessonCount, long totalDuration, boolean isFree, boolean enrolled,
                            double averageRating, long totalReviews) {
        this(id, name, description, thumbnailUrl, instructor, categoryId, categoryName, level,
                lessonCount, totalDuration, isFree, enrolled, averageRating, totalReviews,
                categoryName == null ? List.of() : List.of(categoryName));
    }
}
