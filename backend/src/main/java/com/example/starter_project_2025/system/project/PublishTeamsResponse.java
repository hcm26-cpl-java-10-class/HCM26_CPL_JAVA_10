package com.example.starter_project_2025.system.project;

import java.util.List;

public record PublishTeamsResponse(
        Long allocationSessionId,
        List<Long> succeededItems,
        List<FailedItem> failedItems
) {
    public record FailedItem(
            Long teamId,
            String errorCode,
            String message,
            Long memberId,
            Long conflictingTeamId
    ) {
    }
}
