package com.example.starter_project_2025.system.schedule_version;

import java.util.List;

/**
 * Kết quả kiểm tra toàn bộ xung đột lịch của một phiên bản.
 * Chủ sở hữu: Phát.
 */
public record ScheduleVersionValidationResult(
        Long versionId,
        boolean valid,
        List<ConflictIssue> issues
) {
    public record ConflictIssue(
            String code,
            String field,
            String message,
            Long conflictSessionId
    ) {}
}
