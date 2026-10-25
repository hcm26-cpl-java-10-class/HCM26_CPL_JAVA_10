package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.project.sprint.TaskStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record TaskStatusUpdateRequest(
        @NotNull(message = "Trạng thái là bắt buộc")
        TaskStatus status,

        @NotNull(message = "Phiên bản Task là bắt buộc")
        @PositiveOrZero(message = "Phiên bản Task không hợp lệ")
        Long expectedVersion
) {
}
