package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.project.board.SprintSummaryResponse;

import java.util.List;

public record ProjectTaskListResponse(
        Long projectId,
        SprintSummaryResponse sprint,
        List<TaskListItemResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages
) {
}
