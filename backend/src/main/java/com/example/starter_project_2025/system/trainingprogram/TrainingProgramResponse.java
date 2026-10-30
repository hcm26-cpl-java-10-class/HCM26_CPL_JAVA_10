package com.example.starter_project_2025.system.trainingprogram;

import java.util.List;

public record TrainingProgramResponse(
        Long id,
        String code,
        String name,
        String version,
        String region,
        ProgramStatus status,
        Boolean isActive,
        List<ProgramSubjectResponse> subjects,
        Integer totalDurationHours
) {
    public record ProgramSubjectResponse(
            Long id,
            Long subjectId,
            String code,
            String name,
            String version,
            Integer durationHours,
            Integer orderIndex
    ) {}
}
