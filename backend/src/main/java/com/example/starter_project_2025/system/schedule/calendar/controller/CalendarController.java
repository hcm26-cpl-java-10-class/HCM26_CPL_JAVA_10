package com.example.starter_project_2025.system.schedule.calendar.controller;

import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarResponse;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarSummaryResponse;
import com.example.starter_project_2025.system.schedule.calendar.service.CalendarService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api")
@Tag(
        name = "Calendar",
        description = "APIs for managing class calendars"
)
public class CalendarController {

    private final CalendarService calendarService;

    @PostMapping("/classes/{classId}/calendar")
    @PreAuthorize("hasAuthority('CALENDAR_CREATE')")
    public ResponseEntity<CalendarResponse> createCalendar(
            @PathVariable("classId") Long classId) {

        CalendarResponse response =
                calendarService.createCalendar(classId);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }

    @GetMapping("/calendars")
    @PreAuthorize("hasAuthority('CALENDAR_READ')")
    public ResponseEntity<List<CalendarSummaryResponse>> getCalendars() {
        return ResponseEntity.ok(
                calendarService.getActiveCalendars()
        );
    }
}