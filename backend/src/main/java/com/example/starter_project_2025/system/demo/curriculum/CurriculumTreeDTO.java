package com.example.starter_project_2025.system.demo.curriculum;

import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;

import java.util.List;

public record CurriculumTreeDTO(
        Long courseId,
        String courseName,
        CourseStatus status,
        List<SectionNode> sections
) {

    public record SectionNode(
            Long id,
            String title,
            Integer orderIndex,
            Boolean isActive,
            List<LessonNode> lessons
    ) {
    }

    public record LessonNode(
            Long id,
            Long sectionId,
            String title,
            LessonContentType contentType,
            String contentUrl,
            String textContent,
            Integer duration,
            Integer orderIndex,
            Boolean isActive
    ) {
    }
}