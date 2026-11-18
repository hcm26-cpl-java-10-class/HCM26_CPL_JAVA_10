package com.example.starter_project_2025.system.topic_mark.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Gradebook response containing dynamic column definitions and student rows with their scores")
public class TopicMarkGradebookResponse {

    @Schema(description = "Ordered column definitions – dynamic score columns first, then meta columns")
    private List<Column> columns;

    @Schema(description = "One row per enrolled student")
    private List<Row> rows;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Column definition for the gradebook table")
    public static class Column {

        @Schema(description = "Unique key: '{componentId}_{componentIndex}' or reserved key (FINAL_SCORE, IS_PASSED)",
                example = "123e4567-e89b-12d3-a456-426614174000_1")
        private String key;

        @Schema(description = "Display label", example = "Quiz 1")
        private String label;

        @Schema(description = "UUID of the TopicAssessmentComponent; null for meta columns", nullable = true)
        private String componentId;

        @Schema(description = "1-based slot index within the component; null for meta columns", nullable = true, example = "1")
        private Integer componentIndex;

        @Schema(description = "Assessment type (QUIZ, ASSIGNMENT, …); null for meta columns", nullable = true, example = "QUIZ")
        private String componentType;

        @Schema(description = "Component weight (%); null for meta columns", nullable = true, example = "30.0")
        private Double weight;

        @Schema(description = "Whether this component counts toward final score; null for meta columns", nullable = true)
        private Boolean isGraded;

        public Column(String key, String label) {
            this.key = key;
            this.label = label;
        }
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @Schema(description = "Student row in the gradebook")
    public static class Row {

        @Schema(description = "Student user ID")
        private UUID userId;

        @Schema(description = "Student full name", example = "John Doe")
        private String fullName;

        @Schema(description = "Student email", example = "john.doe@example.com")
        private String email;

        @Schema(description = "Score / meta values keyed by column key")
        private Map<String, Object> values;
    }
}
