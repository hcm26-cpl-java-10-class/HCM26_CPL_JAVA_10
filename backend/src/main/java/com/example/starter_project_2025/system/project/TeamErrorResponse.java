package com.example.starter_project_2025.system.project;

import java.time.LocalDateTime;

public record TeamErrorResponse(
        int status,
        String errorCode,
        String message,
        Long memberId,
        Long conflictingTeamId,
        LocalDateTime timestamp
) {
}