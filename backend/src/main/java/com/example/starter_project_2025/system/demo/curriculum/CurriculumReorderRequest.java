package com.example.starter_project_2025.system.demo.curriculum;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * {
 *   "sections": [ { "id": 1, "orderIndex": 1 }, { "id": 2, "orderIndex": 0 } ],
 *   "lessons":  [ { "id": 10, "sectionId": 2, "orderIndex": 0 }, { "id": 11, "orderIndex": 1 } ]
 * }
 * Lesson.sectionId null = giữ Section hiện tại; khác = chuyển sang Section đó.
 */
public record CurriculumReorderRequest(
        @Valid @Size(max = 500, message = "Too many sections in one request") List<SectionOrder> sections,
        @Valid @Size(max = 2000, message = "Too many lessons in one request") List<LessonOrder> lessons
) {

    public record SectionOrder(
            @NotNull(message = "Section id is required") Long id,
            @NotNull(message = "Order index is required")
            @Min(value = 0, message = "Order index must not be negative") Integer orderIndex
    ) {
    }

    public record LessonOrder(
            @NotNull(message = "Lesson id is required") Long id,
            Long sectionId,
            @NotNull(message = "Order index is required")
            @Min(value = 0, message = "Order index must not be negative") Integer orderIndex
    ) {
    }
}