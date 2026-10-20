package com.example.starter_project_2025.system.schedule.detection.dto;

import com.example.starter_project_2025.system.schedule.conflict_resolution.ConflictResolutionReason;
import com.example.starter_project_2025.system.schedule.conflict_resolution.ConflictResolutionStatus;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import com.example.starter_project_2025.system.schedule.detection.ConflictType;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.EnumSet;
import java.util.Set;

/** A conflicting pair can share both a trainer and a room. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ConflictDTO {
    SessionDTO session;
    SessionDTO conflictingSession;
    String conflictKey;

    @Builder.Default
    Set<ConflictType> conflictTypes = EnumSet.noneOf(ConflictType.class);

    @Builder.Default
    Set<ConflictType> blockingConflictTypes = EnumSet.noneOf(ConflictType.class);

    @Builder.Default
    Set<ConflictType> waivedConflictTypes = EnumSet.noneOf(ConflictType.class);

    @Builder.Default
    boolean blocking = true;

    Long resolutionId;
    ConflictResolutionStatus resolutionStatus;
    ConflictResolutionReason resolutionReason;
}
