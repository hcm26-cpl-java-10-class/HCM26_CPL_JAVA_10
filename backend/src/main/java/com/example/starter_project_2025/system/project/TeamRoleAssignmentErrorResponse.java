package com.example.starter_project_2025.system.project;

import java.time.LocalDateTime;
import java.util.List;

public record TeamRoleAssignmentErrorResponse(
        int status,
        String errorCode,
        String message,
        List<Long> invalidMemberIds,
        LocalDateTime timestamp
) {
}
