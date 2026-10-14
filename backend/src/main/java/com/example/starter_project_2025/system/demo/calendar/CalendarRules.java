package com.example.starter_project_2025.system.demo.calendar;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.demo.calendar_version.CalendarVersion;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Component
public class CalendarRules {
    public void dates(LocalDate start, LocalDate end, ValidationContext ctx) {
        if (start == null) ctx.add("classStartDate", "Class start date is required");
        if (end == null) ctx.add("classEndDate", "Class end date is required");
        if (start != null && end != null && end.isBefore(start)) {
            ctx.add("classEndDate", "Class end date must be on or after start date");
        }
    }

    public void session(LocalDateTime start, LocalDateTime end, LocalDate classStart,
                        LocalDate classEnd, String prefix, ValidationContext ctx) {
        if (start == null) ctx.add(prefix + "startTime", "Start time is required");
        if (end == null) ctx.add(prefix + "endTime", "End time is required");
        if (start == null || end == null) return;
        if (!end.isAfter(start)) ctx.add(prefix + "endTime", "End time must be after start time");
        if (classStart == null || classEnd == null) {
            ctx.add(prefix + "calendarVersionId", "Calendar must have class dates");
            return;
        }
        if (start.isBefore(classStart.atStartOfDay()) || start.toLocalDate().isAfter(classEnd)) {
            ctx.add(prefix + "startTime", "Session must start within class dates");
        }
        // Equivalent to end <= endDate + 1 day at midnight, without overflowing LocalDate.MAX.
        boolean endsAtBoundary = end.toLocalTime().equals(java.time.LocalTime.MIDNIGHT)
                && end.toLocalDate().minusDays(1).equals(classEnd);
        if (end.toLocalDate().isAfter(classEnd) && !endsAtBoundary) {
            ctx.add(prefix + "endTime", "Session must end within class dates");
        }
    }

    public void requireDraft(CalendarVersion version) {
        if (version.getPublishedAt() != null || version.getStatus() == CalendarVersion.Status.ACTIVE) {
            throw new ConflictException("Published calendar versions are read-only; clone a new draft");
        }
    }
}
