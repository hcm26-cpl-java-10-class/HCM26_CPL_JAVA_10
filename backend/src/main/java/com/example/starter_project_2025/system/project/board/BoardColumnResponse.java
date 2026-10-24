package com.example.starter_project_2025.system.project.board;

import java.util.List;

public record BoardColumnResponse(
        String key,
        String name,
        int count,
        List<TaskCardResponse> tasks
) {
}
