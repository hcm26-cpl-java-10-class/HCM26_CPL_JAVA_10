package com.example.starter_project_2025.system.schedule.calendar.controller;


import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarResponse;
import com.example.starter_project_2025.system.schedule.calendar.service.CalendarService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;


@RestController
@RequiredArgsConstructor
@RequestMapping("/api/classes/{classId}/calendar")
@Tag(
        name = "Calendar",
        description = "APIs for managing class calendars"
)
public class CalendarController {

    private final CalendarService calendarService;

    @PostMapping
    @PreAuthorize("hasAuthority('CALENDAR_CREATE')")
    public ResponseEntity<CalendarResponse> createCalendar(
            @PathVariable("classId") Long classId) {

        CalendarResponse response =
                calendarService.createCalendar(classId);

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(response);
    }
}