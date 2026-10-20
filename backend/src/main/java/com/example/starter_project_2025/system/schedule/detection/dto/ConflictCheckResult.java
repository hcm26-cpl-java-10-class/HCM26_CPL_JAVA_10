package com.example.starter_project_2025.system.schedule.detection.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashSet;
import java.util.Set;

/** Validation errors must be checked even when hasConflict is false. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ConflictCheckResult {
    Long calendarVersionId;
    boolean hasConflict;
    boolean hasBlockingConflict;
    boolean canActivate;
    int conflictCount;
    int blockingConflictCount;
    int approvedOverrideCount;
    int acknowledgedCount;

    @Builder.Default
    List<ConflictDTO> conflicts = new ArrayList<>();

    @Builder.Default
    Map<String, List<String>> validationErrors = new LinkedHashMap<>();

    /** Internal activation metadata; intentionally hidden from the public JSON response. */
    @JsonIgnore
    @Builder.Default
    Set<Long> applicableResolutionIds = new LinkedHashSet<>();
}
