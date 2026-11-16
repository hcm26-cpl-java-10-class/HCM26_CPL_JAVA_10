package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.question.domain.Difficulty;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.CodeSpecDTO;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

public class AiQuestionGeneratorDTO {

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class QuestionTypeRequestItem {
        @NotNull
        private QuestionType type;

        @Min(1)
        @Max(20)
        @Builder.Default
        private int count = 1;

        @Builder.Default
        private Difficulty difficulty = Difficulty.MEDIUM;

        @Min(1)
        @Builder.Default
        private int points = 1;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GenerateRequest {
        @NotBlank
        private String mode; // "PROMPT" or "DOCUMENT"

        private String prompt;

        private String documentContent;

        private Long courseId;

        private Long examId;

        private String courseName;

        private String examTitle;

        private String topic;

        private String language; // "vi" / "en" / "Vietnamese" / "English"

        private String additionalInstructions;

        @NotEmpty
        @Builder.Default
        private List<QuestionTypeRequestItem> requests = new ArrayList<>();
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class OptionItem {
        private String content;
        private boolean correct;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GradingCriterionItem {
        private String name;
        private String description;
        private int weightPercentage;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GeneratedQuestion {
        private String tempId;

        private QuestionType type;

        private Difficulty difficulty;

        private String content;

        private int points;

        private String topic;

        private String explanation;

        // Multiple choice options
        @Builder.Default
        private List<OptionItem> options = new ArrayList<>();

        // Essay specific
        private String studentInstructions;
        private String referenceAnswer;
        private String rubric;
        @Builder.Default
        private List<GradingCriterionItem> gradingCriteria = new ArrayList<>();

        // Coding specific
        private CodeSpecDTO code;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GenerateResponse {
        private boolean isFallback;
        private String provider; // "GEMINI" or "FALLBACK"
        private String model;
        private String message;
        @Builder.Default
        private List<GeneratedQuestion> questions = new ArrayList<>();
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class RegenerateSingleRequest {
        @NotNull
        private GeneratedQuestion question;

        private String instruction;

        private String topic;

        private String language;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DocumentExtractResponse {
        private String fileName;
        private long fileSize;
        private int charCount;
        private String extractedText;
        private String status;
        private String message;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class GeneratorStatusResponse {
        private boolean enabled;
        private boolean configured;
        private String provider;
        private String model;
        private String message;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CommitToExamRequest {
        private Long examId;

        @NotEmpty
        @Builder.Default
        private List<GeneratedQuestion> questions = new ArrayList<>();
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class CommitToExamResponse {
        private Long examId;
        private int addedCount;
        @Builder.Default
        private List<Long> questionIds = new ArrayList<>();
        private String message;
    }
}
