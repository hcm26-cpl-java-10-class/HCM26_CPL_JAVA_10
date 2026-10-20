package com.example.starter_project_2025.system.schedule.detection;

import com.example.starter_project_2025.system.schedule.conflict_resolution.ConflictResolutionService;
import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/calendar-versions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Schedule Conflict Detection", description = "Detect conflicts in a DRAFT calendar version")
public class ConflictDetectionController {

    ConflictDetectionService conflictDetectionService;
    ConflictResolutionService conflictResolutionService;

    @GetMapping("/{calendarVersionId}/conflicts")
    @PreAuthorize("hasAuthority('CALENDARVERSION_READ')")
    @Operation(summary = "Check a DRAFT against itself and ACTIVE versions of other classes")
    public ResponseEntity<ConflictCheckResult> checkConflicts(
            @PathVariable Long calendarVersionId
    ) {
        ConflictCheckResult rawResult = conflictDetectionService.checkConflicts(calendarVersionId);
        return ResponseEntity.ok(conflictResolutionService.resolve(rawResult));
    }
}
