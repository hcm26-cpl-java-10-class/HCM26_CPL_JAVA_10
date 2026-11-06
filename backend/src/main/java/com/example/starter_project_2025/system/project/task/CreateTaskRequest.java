package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.project.sprint.TaskPriority;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateTaskRequest(
        @NotBlank(message = "Tên công việc không được để trống")
        @Size(max = 255, message = "Tên công việc tối đa 255 ký tự")
        String title,

        @Size(max = 100000, message = "Description must not exceed 100000 characters")
        String description,

        @DecimalMin(value = "0.0", inclusive = false, message = "Estimate phải lớn hơn 0")
        Double estimatedHours,

        TaskPriority priority,

        Long assigneeProjectMemberId
) {
}
