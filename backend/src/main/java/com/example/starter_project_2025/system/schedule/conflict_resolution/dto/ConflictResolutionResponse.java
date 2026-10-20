package com.example.starter_project_2025.system.schedule.conflict_resolution.dto;

import com.example.starter_project_2025.system.schedule.conflict_resolution.ConflictResolutionReason;
import com.example.starter_project_2025.system.schedule.conflict_resolution.ConflictResolutionStatus;
import com.example.starter_project_2025.system.schedule.detection.ConflictType;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Set;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ConflictResolutionResponse {
    Long id;
    Long calendarVersionId;
    Long sessionId;
    Long conflictingSessionId;
    String conflictKey;
    ConflictResolutionReason reasonCode;
    ConflictResolutionStatus status;

    @Builder.Default
    Set<ConflictType> detectedConflictTypes = EnumSet.noneOf(ConflictType.class);

    @Builder.Default
    Set<ConflictType> waivedConflictTypes = EnumSet.noneOf(ConflictType.class);

    String justification;
    String referenceCode;
    String sessionArea;
    String conflictingSessionArea;
    LocalDateTime expectedResolutionAt;
    Long requestedBy;
    LocalDateTime requestedAt;
    Long approvedBy;
    LocalDateTime approvedAt;
    Long rejectedBy;
    LocalDateTime rejectedAt;
    String rejectionReason;
    Long revokedBy;
    LocalDateTime revokedAt;
    String revocationReason;
    Long appliedBy;
    LocalDateTime appliedAt;
    Long sessionVersion;
    Long conflictingSessionVersion;
    boolean stale;

    @Builder.Default
    List<ConflictResolutionAuditEventResponse> auditTrail = new ArrayList<>();
}
