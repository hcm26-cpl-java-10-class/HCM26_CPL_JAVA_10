package com.example.starter_project_2025.system.schedule.calendar.crud;

import com.example.starter_project_2025.system.external_api.ExternalApiService;
import java.time.DateTimeException;
import java.time.LocalTime;

import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.ConflictException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Component
@lombok.RequiredArgsConstructor
public class CalendarRules {
    private static final Logger log = LoggerFactory.getLogger(CalendarRules.class);
    private final ExternalApiService externalApiService;

    public void sessionForCalendar(Calendar calendar, LocalDateTime start, LocalDateTime end,
                                   String prefix, ValidationContext ctx) {
        LocalDate first = calendar.getClassStartDate();
        LocalDate last = calendar.getClassEndDate();
        if (first == null || last == null) {
            try {
                var external = externalApiService.fetchClassById(calendar.getClassId());
                if (external == null || !calendar.getClassId().equals(external.getId())) {
                    log.warn("External API returned no data for class (id={}), skipping date-range validation",
                            calendar.getClassId());
                    // Skip date-range validation gracefully when external data is unavailable
                    return;
                }
                try {
                    first = LocalDate.parse(external.getStartDate());
                    last = LocalDate.parse(external.getEndDate());
                } catch (DateTimeException | NullPointerException ex) {
                    ctx.add(prefix + "calendarVersionId", "Class dates must use yyyy-MM-dd");
                    return;
                }
            } catch (Exception e) {
                log.warn("External API is unreachable for class (id={}), skipping date-range validation: {}",
                        calendar.getClassId(), e.getMessage());
                // Gracefully skip validation when the external service is not available
                return;
            }
        }
        dates(first, last, ctx);
        session(start, end, first, last, prefix, ctx);
    }

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
        boolean endsAtBoundary = end.toLocalTime().equals(LocalTime.MIDNIGHT)
                && end.toLocalDate().minusDays(1).equals(classEnd);
        if (end.toLocalDate().isAfter(classEnd) && !endsAtBoundary) {
            ctx.add(prefix + "endTime", "Session must end within class dates");
        }
    }

    public void requireDraft(CalendarVersion version) {
        if (version.getPublishedAt() != null || version.getStatus() != CalendarVersionStatus.DRAFT) {
            throw new ConflictException("Published calendar versions are read-only; clone a new draft");
        }
    }
}
