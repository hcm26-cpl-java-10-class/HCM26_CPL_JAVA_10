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

    // ---------- picker data (instructor / categories) ----------

    public record PersonOption(Long id, String name, String email) {
    }

    public record CategoryOption(Long id, String name) {
    }

    /** teachers = active users with role TEACHER; currentTeacherId = set when the logged-in user is a teacher. */
    public record OptionsResponse(List<PersonOption> teachers, List<CategoryOption> categories, Long currentTeacherId) {
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

    /** One choice shown to the user. categoryIds = categories the AI suggests (already validated). */
    public record Option(String label, String rationale, CourseOutline course, List<Long> categoryIds) {
    }

    /** options is empty when the AI is asking a clarifying question. */
    public record ChatResponse(String reply, List<Option> options) {
    }

    // ---------- apply ----------

    public record ApplyRequest(
            @NotNull @Valid CourseOutline course,
            List<Long> categoryIds,
            Long instructorId
    ) {
    }

    public record LessonRef(Long id, String title) {
    }

    public record ApplyResult(Long courseId, String courseName, int sections, int lessons, List<LessonRef> lessonRefs) {
    }

    // ---------- lesson content generation ----------

    /** Generate (and optionally save) the text of an existing lesson. language = "en" | "vi" | null (same as the course). */
    public record GenerateContentRequest(Boolean save, Boolean overwrite, String language) {
    }

    /** Draft the text of a lesson from the form (works for a lesson that is not saved yet). Nothing is saved. */
    public record DraftContentRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 20000) String notes,
            Long lessonId,
            String language
    ) {
    }

    public record GenerateContentResponse(Long lessonId, String content, boolean saved, boolean skipped, String message) {
    }
}