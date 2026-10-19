package com.example.starter_project_2025.system.schedule.detection.dto;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

    @Builder.Default
    List<ConflictDTO> conflicts = new ArrayList<>();

    @Builder.Default
    Map<String, List<String>> validationErrors = new LinkedHashMap<>();
}
