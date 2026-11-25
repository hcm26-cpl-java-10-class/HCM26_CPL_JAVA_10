package com.example.starter_project_2025.system.project.task;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record UpdateTaskOrderRequest(
        @NotNull(message = "Thứ tự là bắt buộc")
        @PositiveOrZero(message = "Thứ tự không hợp lệ")
        Integer orderIndex,
        @NotNull(message = "Phiên bản Task là bắt buộc")
        @PositiveOrZero(message = "Phiên bản Task không hợp lệ")
        Long expectedVersion
) {
}