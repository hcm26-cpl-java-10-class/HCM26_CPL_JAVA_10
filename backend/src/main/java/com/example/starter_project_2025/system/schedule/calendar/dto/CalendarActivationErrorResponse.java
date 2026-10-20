package com.example.starter_project_2025.system.schedule.calendar.dto;

import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;

import java.time.LocalDateTime;

public record CalendarActivationErrorResponse(
        int status,
        String code,
        String message,
        ConflictCheckResult conflictCheck,
        LocalDateTime timestamp
) {
}
