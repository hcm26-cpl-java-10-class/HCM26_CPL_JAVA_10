package com.example.starter_project_2025.system.project.milestone.dto.response;

import java.util.UUID;

public record ChecklistItemResponse(
        UUID id,
        String content,
        boolean mandatory,
        boolean completed,
        int orderIndex
) {
}

