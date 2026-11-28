package com.example.starter_project_2025.system.project.aiassistant.dto.response;

import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotDTO;

public record AIReviewSuggestionApplyResponse(
        AIReviewSuggestionResponse suggestion,
        ProjectTemplateSnapshotDTO snapshot
) {
}
