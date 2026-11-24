package com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review;

import java.util.List;

public record AIReviewOutput(
        String summary,
        List<AIReviewFindingOutput> findings
) {
}