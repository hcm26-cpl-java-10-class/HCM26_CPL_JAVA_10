package com.example.starter_project_2025.system.project.workspace.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import java.util.List;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public record WorkspaceTopicSnapshotResponse(
        String topicCode,
        String topicTitle,
        String version,
        String description,
        String objectives,
        List<String> requirements,
        List<Attachment> attachments) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Attachment(String name, String url) { }
}
