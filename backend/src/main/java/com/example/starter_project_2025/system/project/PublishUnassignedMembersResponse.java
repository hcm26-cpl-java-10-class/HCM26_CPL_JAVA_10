package com.example.starter_project_2025.system.project;

import java.time.LocalDateTime;
import java.util.List;

public record PublishUnassignedMembersResponse(
        int status,
        String errorCode,
        String message,
        int unassignedCount,
        List<Long> unassignedMemberIds,
        LocalDateTime timestamp
) {
}
