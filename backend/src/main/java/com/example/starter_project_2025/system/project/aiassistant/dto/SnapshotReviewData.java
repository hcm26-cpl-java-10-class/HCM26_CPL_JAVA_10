package com.example.starter_project_2025.system.project.aiassistant.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

public record SnapshotReviewData(
        Long templateId,
        Integer templateVersion,
        String code,
        String name,
        String description,
        String technologyStack,
        Long parentTemplateId,
        String category,
        String level,
        Integer estimatedDurationWeeks,
        JsonNode constraints,
        List<JsonNode> milestones,
        List<JsonNode> backlogItems,
        JsonNode modules
) {
}