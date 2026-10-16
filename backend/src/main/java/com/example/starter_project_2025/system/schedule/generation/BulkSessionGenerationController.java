package com.example.starter_project_2025.system.schedule.generation;

import com.example.starter_project_2025.system.schedule.generation.dto.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "F16 - Bulk Session Generation", description = "APIs for bulk schedule generation and preview from Program Topics")
public class BulkSessionGenerationController {

    BulkSessionGenerationService generationService;

    @GetMapping("/classes/{classId}/schedule-generation/context")
    @Operation(summary = "Get curriculum topics and trainer context for schedule generation (US-F16-01)")
    public ResponseEntity<ScheduleGenerationContextResponse> getGenerationContext(
            @PathVariable Long classId) {
        return ResponseEntity.ok(generationService.getGenerationContext(classId));
    }

    @PostMapping("/classes/{classId}/schedule-generation/preview")
    @Operation(summary = "Calculate and preview draft schedule sessions in RAM (US-F16-02)")
    public ResponseEntity<BulkPreviewResponseDTO> generatePreview(
            @PathVariable Long classId,
            @Valid @RequestBody BulkPreviewRequestDTO request) {
        return ResponseEntity.ok(generationService.generatePreview(classId, request));
    }

    @PostMapping("/calendar-versions/{versionId}/bulk-sessions")
    @Operation(summary = "Save bulk previewed sessions to CalendarVersion DRAFT (All-or-Nothing) (US-F16-05)")
    public ResponseEntity<BulkSaveSessionsResponseDTO> saveBulkSessions(
            @PathVariable Long versionId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody BulkSaveSessionsRequestDTO request) {
        BulkSaveSessionsResponseDTO response = generationService.saveBulkSessions(versionId, request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }
}
