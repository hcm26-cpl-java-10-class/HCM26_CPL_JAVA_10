package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.project.sprint.TaskPriority;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Size;

public record UpdateTaskRequest(
        @Size(max = 255, message = "Tên công việc tối đa 255 ký tự")
        String title,

        @Size(max = 1000, message = "Mô tả tối đa 1000 ký tự")
        String description,

        @DecimalMin(value = "0.0", inclusive = false, message = "Estimate phải lớn hơn 0")
        Double estimatedHours,

        TaskPriority priority,

        Long assigneeProjectMemberId
) {
}