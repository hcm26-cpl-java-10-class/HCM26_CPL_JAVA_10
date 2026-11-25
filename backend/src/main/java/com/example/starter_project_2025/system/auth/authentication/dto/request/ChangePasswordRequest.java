package com.example.starter_project_2025.system.auth.authentication.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank(message = "Current password is required")
        String currentPassword,

        @NotBlank(message = "New password is required")
        @Size(min = 8, max = 128, message = "New password must be between 8 and 128 characters")
        String newPassword,

        Boolean revokeOtherSessions
) {
    public boolean shouldRevokeOtherSessions() {
        return revokeOtherSessions == null || Boolean.TRUE.equals(revokeOtherSessions);
    }
}
