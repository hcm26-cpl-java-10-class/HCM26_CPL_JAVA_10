package com.example.starter_project_2025.system.project.aiassistant.dto.response.output;

import com.fasterxml.jackson.databind.JsonNode;

public record ReviewSuggestionOutput(
        String rationale,
        JsonNode changes
) {
}
