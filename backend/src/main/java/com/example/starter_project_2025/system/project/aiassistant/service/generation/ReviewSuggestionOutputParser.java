
package com.example.starter_project_2025.system.project.aiassistant.service.generation;

import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.ReviewSuggestionOutput;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

@Component
public class ReviewSuggestionOutputParser {

    private final ObjectMapper objectMapper;

    public ReviewSuggestionOutputParser(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public ReviewSuggestionOutput parse(String rawContent) {

        if (rawContent == null || rawContent.isBlank()) {
            throw new IllegalArgumentException(
                    "AI review suggestion response is empty"
            );
        }

        try {
            JsonNode root = objectMapper.readTree(rawContent);

            if (!root.isObject()) {
                throw new IllegalArgumentException(
                        "AI review suggestion response must be a JSON object"
                );
            }
            root.fieldNames().forEachRemaining(field -> {
                if (!"rationale".equals(field) && !"changes".equals(field)) {
                    throw new IllegalArgumentException(
                            "Unsupported AI review suggestion response field: " + field
                    );
                }
            });

            JsonNode rationaleNode = root.get("rationale");
            JsonNode changesNode = root.get("changes");

            if (rationaleNode == null || !rationaleNode.isTextual()
                    || rationaleNode.asText().isBlank()) {
                throw new IllegalArgumentException(
                        "AI review suggestion rationale is required"
                );
            }

            if (changesNode == null || !changesNode.isObject()) {
                throw new IllegalArgumentException(
                        "AI review suggestion changes must be a JSON object"
                );
            }

            return new ReviewSuggestionOutput(
                    rationaleNode.asText(),
                    changesNode
            );

        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException(
                    "Failed to parse AI review suggestion JSON",
                    e
            );
        }
    }
}
