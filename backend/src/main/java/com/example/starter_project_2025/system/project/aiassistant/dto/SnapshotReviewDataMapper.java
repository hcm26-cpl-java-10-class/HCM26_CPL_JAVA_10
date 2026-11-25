package com.example.starter_project_2025.system.project.aiassistant.dto;


import com.example.starter_project_2025.system.project.aiassistant.dto.SnapshotReviewData;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class SnapshotReviewDataMapper {

    private final ObjectMapper objectMapper;

    public SnapshotReviewData toData(ProjectTemplateSnapshot snapshot) {
        try {
            return objectMapper.readValue(
                    snapshot.getContentJson(),
                    SnapshotReviewData.class
            );
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                    "Failed to deserialize project template snapshot",
                    exception
            );
        }
    }
}