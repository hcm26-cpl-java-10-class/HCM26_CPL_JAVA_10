package com.example.starter_project_2025.system.demo.bookmark;

/**
 * Response returned after saving or removing a course bookmark.
 */
public record CourseBookmarkStatusResponse(Long courseId, boolean saved) {
}
