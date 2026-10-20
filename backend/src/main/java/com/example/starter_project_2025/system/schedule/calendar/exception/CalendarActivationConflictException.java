package com.example.starter_project_2025.system.schedule.calendar.exception;

import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;
import lombok.Getter;

@Getter
public class CalendarActivationConflictException extends RuntimeException {

    private final ConflictCheckResult conflictCheckResult;

    public CalendarActivationConflictException(ConflictCheckResult conflictCheckResult) {
        super("Calendar version contains unresolved schedule conflicts.");
        this.conflictCheckResult = conflictCheckResult;
    }
}
