package com.example.starter_project_2025.system.schedule_validation;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class ScheduleValidationResult {

    private final boolean valid;
    private final List<ScheduleConflict> conflicts;

    public static ScheduleValidationResult from(List<ScheduleConflict> conflicts) {
        return ScheduleValidationResult.builder()
                .valid(conflicts.isEmpty())
                .conflicts(List.copyOf(conflicts))
                .build();
    }
}
