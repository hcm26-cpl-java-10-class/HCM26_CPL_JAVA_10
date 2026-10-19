package com.example.starter_project_2025.system.schedule.calendar.controller;

import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarSummaryResponse;
import com.example.starter_project_2025.system.schedule.calendar.service.CalendarService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/calendars")
public class CalendarController {

    private final CalendarService calendarService;

    @GetMapping
    @PreAuthorize("hasAuthority('CALENDAR_READ')")
    public ResponseEntity<List<CalendarSummaryResponse>> getCalendars() {
        return ResponseEntity.ok(calendarService.getActiveCalendars());
    }
}