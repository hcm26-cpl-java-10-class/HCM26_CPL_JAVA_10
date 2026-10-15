package com.example.starter_project_2025.system.schedule.calendar.controller;

import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarVersionResponse;
import com.example.starter_project_2025.system.schedule.calendar.dto.CreateCalendarVersionRequest;

import com.example.starter_project_2025.system.schedule.calendar.service.CalendarVersionService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/calendars/{calendarId}/versions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(
        name = "Calendar Version",
        description = "APIs for managing calendar versions"
)
public class CalendarVersionController {

    CalendarVersionService calendarVersionService;

    @PostMapping
    public ResponseEntity<CalendarVersionResponse> createVersion(
            @PathVariable Long calendarId,
            @Valid @RequestBody CreateCalendarVersionRequest request) {

        CalendarVersionResponse response =
                calendarVersionService.createVersion(calendarId, request);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
