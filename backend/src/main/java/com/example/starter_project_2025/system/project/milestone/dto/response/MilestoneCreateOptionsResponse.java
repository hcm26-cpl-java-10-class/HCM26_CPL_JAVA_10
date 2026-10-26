package com.example.starter_project_2025.system.project.milestone.dto.response;

import java.util.List;

public record MilestoneCreateOptionsResponse(
        ProjectOptionResponse project,
        List<RubricOptionResponse> rubrics
) {
}

