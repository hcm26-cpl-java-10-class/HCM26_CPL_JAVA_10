package com.example.starter_project_2025.system.schedule.conflict_resolution.dto;

import com.example.starter_project_2025.system.schedule.conflict_resolution.ConflictResolutionReason;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CreateConflictResolutionRequest {

    @NotNull
    @Positive
    @Schema(description = "First session ID from the conflict response", example = "101")
    Long sessionId;

    @NotNull
    @Positive
    @Schema(description = "Second session ID from the same conflict pair", example = "205")
    Long conflictingSessionId;

    @NotNull
    @Schema(description = "Audited business reason/policy", example = "SHARED_CLASS_SESSION")
    ConflictResolutionReason reasonCode;

    @NotBlank
    @Size(max = 1000)
    @Schema(description = "Human-readable business justification", example = "Two classes attend the same workshop")
    String justification;

    @Size(max = 120)
    @Schema(description = "Approval, event or facility reference; required for an actual override", example = "WS-2026-001")
    String referenceCode;

    @Size(max = 120)
    @Schema(description = "Physical area used by sessionId; required for ROOM_PARTITIONED", example = "Hall A - Zone 1")
    String sessionArea;

    @Size(max = 120)
    @Schema(description = "Physical area used by conflictingSessionId; required for ROOM_PARTITIONED", example = "Hall A - Zone 2")
    String conflictingSessionArea;

    @Future
    @Schema(description = "Target resolution time, mainly for acknowledgement", example = "2026-10-25T17:00:00")
    LocalDateTime expectedResolutionAt;

    /** Optional optimistic preconditions supplied by the conflict response. */
    @Schema(description = "Optimistic version returned in conflict.session.version", example = "0")
    Long sessionVersion;

    @Schema(description = "Optimistic version returned in conflict.conflictingSession.version", example = "0")
    Long conflictingSessionVersion;
}
