package com.example.starter_project_2025.system.schedule.conflict_resolution;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.schedule.conflict_resolution.dto.ConflictResolutionDecisionRequest;
import com.example.starter_project_2025.system.schedule.conflict_resolution.dto.ConflictResolutionResponse;
import com.example.starter_project_2025.system.schedule.conflict_resolution.dto.CreateConflictResolutionRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/calendar-versions/{calendarVersionId}/conflict-resolutions")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(
        name = "Schedule Conflict Resolution",
        description = "Request, acknowledge, approve, reject and revoke audited conflict resolutions"
)
public class ConflictResolutionController {

    ConflictResolutionService conflictResolutionService;

    @PostMapping
    @PreAuthorize("hasAuthority('SCHEDULE_CONFLICT_RESOLUTION_REQUEST')")
    @Operation(
            summary = "Request an override or acknowledge a current DRAFT conflict",
            description = "SHARED_CLASS_SESSION and ROOM_PARTITIONED create PENDING requests. "
                    + "ACKNOWLEDGED_PENDING_RESOLUTION is recorded immediately but never unblocks activation.",
            responses = {
                    @ApiResponse(responseCode = "201", description = "Resolution record created"),
                    @ApiResponse(responseCode = "409", description = "Conflict disappeared, request is stale, or an open duplicate exists"),
                    @ApiResponse(responseCode = "422", description = "The selected reason is not eligible for this conflict")
            }
    )
    @RequestBody(
            required = true,
            content = @Content(
                    schema = @Schema(implementation = CreateConflictResolutionRequest.class),
                    examples = {
                            @ExampleObject(
                                    name = "Shared class session",
                                    value = """
                                            {
                                              "sessionId": 101,
                                              "conflictingSessionId": 205,
                                              "reasonCode": "SHARED_CLASS_SESSION",
                                              "justification": "Two classes attend the same Spring Security workshop",
                                              "referenceCode": "WS-SPRING-2026-01",
                                              "sessionVersion": 0,
                                              "conflictingSessionVersion": 0
                                            }
                                            """
                            ),
                            @ExampleObject(
                                    name = "Partitioned room",
                                    value = """
                                            {
                                              "sessionId": 101,
                                              "conflictingSessionId": 205,
                                              "reasonCode": "ROOM_PARTITIONED",
                                              "justification": "The hall is separated by an acoustic partition",
                                              "referenceCode": "FACILITY-2026-018",
                                              "sessionArea": "Hall A - Zone 1",
                                              "conflictingSessionArea": "Hall A - Zone 2",
                                              "sessionVersion": 0,
                                              "conflictingSessionVersion": 0
                                            }
                                            """
                            ),
                            @ExampleObject(
                                    name = "Acknowledged pending resolution",
                                    value = """
                                            {
                                              "sessionId": 101,
                                              "conflictingSessionId": 205,
                                              "reasonCode": "ACKNOWLEDGED_PENDING_RESOLUTION",
                                              "justification": "The coordinator is arranging a new time slot",
                                              "expectedResolutionAt": "2026-10-25T17:00:00",
                                              "sessionVersion": 0,
                                              "conflictingSessionVersion": 0
                                            }
                                            """
                            )
                    }
            )
    )
    public ResponseEntity<ConflictResolutionResponse> create(
            @PathVariable Long calendarVersionId,
            @Valid @org.springframework.web.bind.annotation.RequestBody CreateConflictResolutionRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        ConflictResolutionResponse response = conflictResolutionService.create(
                calendarVersionId,
                request,
                actorId(principal)
        );
        return ResponseEntity.created(URI.create(
                "/api/calendar-versions/" + calendarVersionId
                        + "/conflict-resolutions/" + response.getId()
        )).body(response);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('SCHEDULE_CONFLICT_RESOLUTION_READ')")
    @Operation(summary = "List resolution and acknowledgement records for a CalendarVersion")
    public ResponseEntity<List<ConflictResolutionResponse>> list(
            @PathVariable Long calendarVersionId
    ) {
        return ResponseEntity.ok(conflictResolutionService.list(calendarVersionId));
    }

    @GetMapping("/{resolutionId}")
    @PreAuthorize("hasAuthority('SCHEDULE_CONFLICT_RESOLUTION_READ')")
    @Operation(summary = "Get one conflict resolution including its audit trail")
    public ResponseEntity<ConflictResolutionResponse> get(
            @PathVariable Long calendarVersionId,
            @PathVariable Long resolutionId
    ) {
        return ResponseEntity.ok(conflictResolutionService.get(calendarVersionId, resolutionId));
    }

    @PostMapping("/{resolutionId}/approve")
    @PreAuthorize("hasAuthority('SCHEDULE_CONFLICT_RESOLUTION_APPROVE')")
    @Operation(
            summary = "Approve an override request",
            description = "Uses four-eyes control: the requester cannot approve their own request. "
                    + "The conflict and both optimistic session versions are revalidated."
    )
    public ResponseEntity<ConflictResolutionResponse> approve(
            @PathVariable Long calendarVersionId,
            @PathVariable Long resolutionId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(conflictResolutionService.approve(
                calendarVersionId,
                resolutionId,
                actorId(principal)
        ));
    }

    @PostMapping("/{resolutionId}/reject")
    @PreAuthorize("hasAuthority('SCHEDULE_CONFLICT_RESOLUTION_APPROVE')")
    @Operation(summary = "Reject a pending override request")
    public ResponseEntity<ConflictResolutionResponse> reject(
            @PathVariable Long calendarVersionId,
            @PathVariable Long resolutionId,
            @Valid @org.springframework.web.bind.annotation.RequestBody ConflictResolutionDecisionRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(conflictResolutionService.reject(
                calendarVersionId,
                resolutionId,
                request,
                actorId(principal)
        ));
    }

    @PostMapping("/{resolutionId}/revoke")
    @PreAuthorize("hasAuthority('SCHEDULE_CONFLICT_RESOLUTION_REVOKE')")
    @Operation(summary = "Revoke an approved override before activation")
    public ResponseEntity<ConflictResolutionResponse> revoke(
            @PathVariable Long calendarVersionId,
            @PathVariable Long resolutionId,
            @Valid @org.springframework.web.bind.annotation.RequestBody ConflictResolutionDecisionRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(conflictResolutionService.revoke(
                calendarVersionId,
                resolutionId,
                request,
                actorId(principal)
        ));
    }

    private Long actorId(UserPrincipal principal) {
        return principal == null || principal.getUser() == null
                ? null
                : principal.getUser().getId();
    }
}
