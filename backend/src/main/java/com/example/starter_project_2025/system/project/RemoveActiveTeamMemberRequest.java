package com.example.starter_project_2025.system.project;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RemoveActiveTeamMemberRequest(
        @NotBlank(message = "Lý do gỡ thành viên là bắt buộc")
        @Size(max = 500, message = "Lý do gỡ không được vượt quá 500 ký tự")
        String reason
) {
}
