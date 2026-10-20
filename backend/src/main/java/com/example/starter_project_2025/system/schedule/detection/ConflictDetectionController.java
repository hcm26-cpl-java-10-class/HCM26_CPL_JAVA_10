package com.example.starter_project_2025.system.schedule.detection;

import com.example.starter_project_2025.system.schedule.detection.dto.ConflictCheckResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/calendar-versions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Conflict Detection", description = "APIs for verifying schedule collisions across calendar versions")
public class ConflictDetectionController {

    ConflictDetectionService conflictDetectionService;

    @GetMapping("/{versionId}/conflicts")
    @PreAuthorize("hasAuthority('CALENDARVERSION_READ') or hasRole('ADMIN')")
    @Operation(summary = "Detect schedule conflicts within a DRAFT calendar version and against ACTIVE versions of other classes")
    public ResponseEntity<ConflictCheckResult> checkConflicts(@PathVariable Long versionId) {
        return ResponseEntity.ok(conflictDetectionService.checkConflicts(versionId));
    }
}
