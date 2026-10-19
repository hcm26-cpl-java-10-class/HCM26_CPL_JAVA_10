package com.example.starter_project_2025.system.schedule_validation;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/schedule-validations")
@Tag(name = "Schedule validation", description = "Checks session scheduling conflicts without saving data")
public class ScheduleValidationController {

    private final ScheduleValidationService scheduleValidationService;

    @PostMapping
    @PreAuthorize("hasAnyAuthority('SESSION_CREATE', 'SESSION_UPDATE')")
    @Operation(summary = "Validate one or more sessions for schedule conflicts")
    public ResponseEntity<ScheduleValidationResult> validate(
            @Valid @RequestBody ScheduleValidationRequest request) {
        return ResponseEntity.ok(scheduleValidationService.validateBatch(request.getSessions()));
    }
}
