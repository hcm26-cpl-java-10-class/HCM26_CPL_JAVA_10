package com.example.starter_project_2025.system.demo.aitutor;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/** Request/response models for the learner-facing AI Tutor. */
public final class AiTutorDTO {

    private AiTutorDTO() {
    }

    /** role = "user" | "assistant". */
    public record ChatMessage(
            @NotBlank String role,
            @NotBlank @Size(max = 2000) String content
    ) {
    }

    /** language = "en" (default) | "vi". */
    public record ChatRequest(
            @NotEmpty @Size(max = 12) List<@Valid ChatMessage> messages,
            String language
    ) {
    }

    /** lessonTextAvailable = false when the answer could not be grounded in written lesson content. */
    public record ChatResponse(String reply, boolean lessonTextAvailable) {
    }

    /** count defaults to 5; allowed range 3..10. */
    public record QuizRequest(
            @Min(3) @Max(10) Integer count,
            String language
    ) {
    }

    /** Self-check question. correctIndex is a 0-based index into options (always 4 options). */
    public record QuizQuestion(String question, List<String> options, int correctIndex, String explanation) {
    }

    public record QuizResponse(List<QuizQuestion> questions) {
    }
}
