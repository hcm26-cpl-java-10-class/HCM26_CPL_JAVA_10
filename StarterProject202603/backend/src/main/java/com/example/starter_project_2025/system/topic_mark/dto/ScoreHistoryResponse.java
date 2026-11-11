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
 * Response wrapper for the paginated score-change history endpoint.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Paginated list of score change history records")
public class ScoreHistoryResponse {

    @Schema(description = "History records for the current page")
    private List<HistoryItem> content;

    @Schema(description = "Zero-based page number", example = "0")
    private int page;

    @Schema(description = "Page size", example = "10")
    private int size;

    @Schema(description = "Total number of history records", example = "25")
    private long totalElements;

    @Schema(description = "Total number of pages", example = "3")
    private int totalPages;

    @Schema(description = "Sort parameter used", example = "updatedAt,desc")
    private String sort;

    // ── Inner types ────────────────────────────────────────────────────────

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "A single score change history record")
    public static class HistoryItem {

        @Schema(description = "History record ID")
        private UUID id;

        @Schema(description = "Training class ID this record belongs to")
        private UUID trainingClassId;

        @Schema(description = "Student whose score was changed")
        private UserRef student;

        @Schema(description = "Gradebook column that was changed")
        private ColumnRef column;

        @Schema(description = "Score before the change", nullable = true, example = "7.0")
        private Double oldScore;

        @Schema(description = "Score after the change", nullable = true, example = "8.0")
        private Double newScore;

        @Schema(description = "Whether the score increased or decreased", example = "INCREASE")
        private String changeType;

        @Schema(description = "Reason provided for the change", example = "Recheck request")
        private String reason;

        @Schema(description = "User who made the change")
        private UserRef updatedBy;

        @Schema(description = "Timestamp of the change")
        private LocalDateTime updatedAt;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Slim user reference")
    public static class UserRef {

        @Schema(description = "User ID")
        private UUID id;

        @Schema(description = "Full name", example = "Nguyen Van A")
        private String name;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Slim column reference")
    public static class ColumnRef {

        @Schema(description = "Column key ({componentId}_{componentIndex})")
        private String id;

        @Schema(description = "Column label", example = "Assignment 1")
        private String name;
    }
}
