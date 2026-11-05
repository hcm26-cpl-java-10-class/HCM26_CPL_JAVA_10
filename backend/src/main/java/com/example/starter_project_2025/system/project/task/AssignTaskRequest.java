package com.example.starter_project_2025.system.project.task;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record AssignTaskRequest(
        Long assigneeProjectMemberId,
        @NotNull(message = "Phiên bản Task là bắt buộc")
        @PositiveOrZero(message = "Phiên bản Task không hợp lệ")
        Long expectedVersion
) {
}