package com.example.starter_project_2025.system.topic_mark.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Detailed view of a single student's topic marks,
 * including per-component slot scores, computed final score, and audit history.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Detailed topic mark view for a single student")
public class TopicMarkDetailResponse {

    @Schema(description = "Student user ID")
    private UUID userId;

    @Schema(description = "Student full name", example = "John Doe")
    private String fullName;

    @Schema(description = "Scores grouped by assessment component")
    private List<ComponentSection> sections;

    @Schema(description = "Computed final score (null if any graded slot is missing)", nullable = true, example = "8.55")
    private Double finalScore;

    @Schema(description = "Whether the student passed", example = "true")
    private Boolean isPassed;

    @Schema(description = "Full score-change audit history for this student")
    private List<HistoryEntry> history;

    // ── Inner types ──────────────────────────────────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Section for one assessment component (e.g. Quiz with 3 slots)")
    public static class ComponentSection {

        @Schema(description = "Component UUID")
        private String componentId;

        @Schema(description = "Component display name", example = "Quiz")
        private String componentName;

        @Schema(description = "Assessment type (QUIZ, ASSIGNMENT, …)", example = "QUIZ")
        private String componentType;

        @Schema(description = "Component weight (%) in final score calculation", example = "30")
        private Double weight;

        @Schema(description = "Whether this component is graded")
        private Boolean isGraded;

        @Schema(description = "Computed average score for this component (null if any slot is missing)")
        private Double sectionScore;

        @Schema(description = "Individual slot scores (one per count index)")
        private List<SlotScore> slots;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Score for a single component slot")
    public static class SlotScore {

        @Schema(description = "1-based slot index", example = "1")
        private Integer index;

        @Schema(description = "Student score, null = not yet entered", nullable = true, example = "8.5")
        private Double score;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Audit entry for a score change")
    public static class HistoryEntry {

        @Schema(description = "Label of the component slot that was changed", example = "Quiz 2")
        private String componentLabel;

        @Schema(description = "Score before the change", nullable = true, example = "7.0")
        private Double oldScore;

        @Schema(description = "Score after the change", nullable = true, example = "8.5")
        private Double newScore;

        @Schema(description = "Type of change: INCREASE or DECREASE", example = "INCREASE")
        private String changeType;

        @Schema(description = "Reason provided for the change", example = "Re-graded after review")
        private String reason;

        @Schema(description = "Full name of the user who made the change", example = "Trainer A")
        private String updatedBy;

        @Schema(description = "Timestamp of the change")
        private LocalDateTime updatedAt;
    }
}
