package com.example.starter_project_2025.system.schedule.calendar.controller;

import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionFilter;
import com.example.starter_project_2025.system.schedule.calendar.dto.CalendarVersionResponse;
import com.example.starter_project_2025.system.schedule.calendar.dto.CreateCalendarVersionRequest;

import com.example.starter_project_2025.system.schedule.calendar.dto.UpdateCalendarVersionRequest;
import com.example.starter_project_2025.system.schedule.calendar.service.CalendarVersionService;
import com.example.starter_project_2025.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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

    @GetMapping
    @PreAuthorize("hasAuthority('CALENDARVERSION_READ')")
    public ResponseEntity<Page<CalendarVersionResponse>> getVersions(
            @PathVariable Long calendarId,
            @PageableDefault(size = 10) Pageable pageable,
            @ModelAttribute CalendarVersionFilter filter) {

        return ResponseEntity.ok(
                calendarVersionService.getVersions(calendarId, filter, pageable)
        );
    }

    @PatchMapping("/{versionId}")
    @PreAuthorize("hasAuthority('CALENDARVERSION_UPDATE')")
    public ResponseEntity<CalendarVersionResponse> updateVersion(
            @PathVariable Long calendarId,
            @PathVariable Long versionId,
            @RequestBody UpdateCalendarVersionRequest request) {

        return ResponseEntity.ok(
                calendarVersionService.updateVersion(calendarId, versionId, request));
    }

    @DeleteMapping("/{versionId}")
    @PreAuthorize("hasAuthority('CALENDARVERSION_DELETE')")
    public ResponseEntity<Void> deleteVersion(
            @PathVariable Long calendarId,
            @PathVariable Long versionId) {

        calendarVersionService.deleteVersion(calendarId, versionId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{versionId}/activate")
    @PreAuthorize("hasAuthority('CALENDARVERSION_UPDATE')")
    @Operation(summary = "Activate a conflict-free DRAFT calendar version")
    public ResponseEntity<CalendarVersionResponse> activateVersion(
            @PathVariable Long calendarId,
            @PathVariable Long versionId,
            @AuthenticationPrincipal UserPrincipal principal) {

        Long activatedBy = principal == null || principal.getUser() == null
                ? null
                : principal.getUser().getId();

        return ResponseEntity.ok(
                calendarVersionService.activateVersion(
                        calendarId,
                        versionId,
                        activatedBy
                )
        );
    }
}
