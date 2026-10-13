package com.example.starter_project_2025.system.topic_mark.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Paginated gradebook search result.
 * Includes static column definitions once + paginated student rows.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Schema(description = "Paginated gradebook search result with column definitions and student rows")
public class TopicMarkGradebookSearchResponse {

    @Schema(description = "Ordered column definitions (score columns + meta columns)")
    private List<TopicMarkGradebookResponse.Column> columns;

    @Schema(description = "Paginated student rows matching the search keyword")
    private TopicMarkPageResponse<TopicMarkGradebookResponse.Row> rows;
}
