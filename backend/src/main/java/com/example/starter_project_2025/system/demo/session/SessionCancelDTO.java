package com.example.starter_project_2025.system.demo.session;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Immutable command payload for cancelling a scheduled training session.
 */
public record SessionCancelDTO(
        @NotBlank(message = "Cancel reason is required")
        @Size(max = 255, message = "Cancel reason must not exceed 255 characters")
        String cancelReason
) {
}
