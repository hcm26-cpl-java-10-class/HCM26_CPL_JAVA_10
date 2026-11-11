package com.example.starter_project_2025.system.schedule_validation;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class ScheduleConflict {

    private final int candidateIndex;
    private final ScheduleConflictType type;
    private final String field;
    private final String message;
    private final Long conflictingSessionId;
    private final String conflictingSessionTitle;
    private final LocalDateTime conflictingStartTime;
    private final LocalDateTime conflictingEndTime;
}
