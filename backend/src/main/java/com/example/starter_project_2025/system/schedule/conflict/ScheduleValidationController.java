package com.example.starter_project_2025.system.schedule.conflict;

import com.example.starter_project_2025.system.schedule.conflict.dto.ScheduleValidationRequest;
import com.example.starter_project_2025.system.schedule.conflict.dto.ScheduleValidationResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController("scheduleConflictValidationController")
@Validated
@RequiredArgsConstructor
@RequestMapping("/api/schedule-versions/{versionId}/validations")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Schedule Validation", description = "Validate candidate sessions before saving")
public class ScheduleValidationController {

    ScheduleConflictService scheduleConflictService;

    @PostMapping
    @PreAuthorize("hasAnyAuthority('SESSION_CREATE', 'SESSION_UPDATE')")
    @Operation(
            summary = "Validate one or more candidate sessions before saving",
            description = "Until ScheduleVersion is added to the base source, candidates include classId directly; versionId is returned as request context and is not resolved against a version record.")
    public ResponseEntity<ScheduleValidationResponse> validateCandidates(
            @PathVariable @Positive Long versionId,
            @Valid @RequestBody ScheduleValidationRequest request) {
        return ResponseEntity.ok(scheduleConflictService.validateCandidates(versionId, request));
    }
}
