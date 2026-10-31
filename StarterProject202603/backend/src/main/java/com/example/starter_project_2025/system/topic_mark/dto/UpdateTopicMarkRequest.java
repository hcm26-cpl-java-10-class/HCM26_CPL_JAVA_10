package com.example.starter_project_2025.system.topic_mark.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.UUID;

/**
 * Request DTO for updating one or more TopicMarkEntry scores for a student,
 * with a mandatory reason for audit purposes.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Request to save / update scores for a student in a topic–class")
public class UpdateTopicMarkRequest {

    @Valid
    @Schema(description = "List of component-slot score pairs to update")
    private List<EntryUpdate> entries;

    @NotBlank(message = "reason is required")
    @Schema(description = "Reason for this score update (required for audit trail)",
            example = "Re-graded after student appeal", required = true)
    private String reason;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Score update for a single component slot")
    public static class EntryUpdate {

        @NotNull(message = "componentId is required")
        @Schema(description = "UUID of the TopicAssessmentComponent", required = true)
        private UUID componentId;

        @NotNull(message = "componentIndex is required")
        @Schema(description = "1-based slot index within the component (e.g. 1 for Quiz 1)", required = true, example = "1")
        private Integer componentIndex;

        @Min(value = 0, message = "score must be >= 0")
        @Max(value = 10, message = "score must be <= 10")
        @Schema(description = "New score value (0–10). Send null to clear the score.",
                nullable = true, example = "8.5")
        private Double score;
    }
}
