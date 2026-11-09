package com.example.starter_project_2025.system.demo.aicourse;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Request/response models for the AI course builder. */
public final class AiCourseBuilderDTO {

    private AiCourseBuilderDTO() {
    }

    // ---------- chat ----------

    /** role = "user" | "assistant". */
    public record ChatMessage(
            @NotBlank String role,
            @NotBlank @Size(max = 4000) String content
    ) {
    }

    /** language = "en" (default) | "vi". */
    public record ChatRequest(
            @NotEmpty @Size(max = 20) List<@Valid ChatMessage> messages,
            String language
    ) {
    }

    /** One lesson in a proposed outline. {@code summary} becomes the draft text of the lesson. */
    public record LessonOutline(String title, String summary, Integer durationMinutes) {
    }

    public record SectionOutline(String title, List<LessonOutline> lessons) {
    }

    /** level = BEGINNER | INTERMEDIATE | ADVANCED. */
    public record CourseOutline(String name, String description, String level, List<SectionOutline> sections) {
    }

    /** One choice shown to the user, e.g. "Compact - 4 sections / 16 lessons". */
    public record Option(String label, String rationale, CourseOutline course) {
    }

    /** options is empty when the AI is asking a clarifying question. */
    public record ChatResponse(String reply, List<Option> options) {
    }

    // ---------- apply ----------

    public record ApplyRequest(
            @NotNull @Valid CourseOutline course,
            List<Long> categoryIds
    ) {
    }

    public record ApplyResult(Long courseId, String courseName, int sections, int lessons) {
    }
}