package com.example.starter_project_2025.system.project.milestone.dto.response;

import java.util.List;

public record MilestonePageResponse(
        ProjectMilestoneSummaryResponse project,
        List<MilestoneListItemResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean hasNext,
        boolean hasPrevious
) {
}

