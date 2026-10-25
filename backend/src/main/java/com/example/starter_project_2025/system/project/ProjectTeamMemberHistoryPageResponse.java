package com.example.starter_project_2025.system.project;

import java.util.List;

public record ProjectTeamMemberHistoryPageResponse(
        List<ProjectTeamMemberHistoryResponse> items,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}
