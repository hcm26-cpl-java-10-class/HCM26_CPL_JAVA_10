package com.example.starter_project_2025.system.project.board;

import java.util.List;

public record ProjectBoardResponse(
        Long projectId,
        Long teamId,
        SprintSummaryResponse sprint,
        List<BoardColumnResponse> columns,
        List<ActivityItemResponse> activityTrail
) {
}
