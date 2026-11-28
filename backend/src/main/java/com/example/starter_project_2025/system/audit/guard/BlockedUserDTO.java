package com.example.starter_project_2025.system.audit.guard;

import java.time.LocalDateTime;

public record BlockedUserDTO(
        Long userId,
        String email,
        String fullName,
        String reason,
        LocalDateTime blockedUntil
) {
}
