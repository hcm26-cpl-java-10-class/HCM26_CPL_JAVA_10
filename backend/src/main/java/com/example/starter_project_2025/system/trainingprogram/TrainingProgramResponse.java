package com.example.starter_project_2025.system.trainingprogram;

import java.time.LocalDateTime;
import java.util.List;

public record TrainingProgramResponse(
        Long id,
        String code,
        String name,
        String version,
        String region,
        String technicalGroup,
        String contentLink,
        String description,
        ProgramStatus status,
        Boolean isActive,
        List<ProgramSubjectResponse> subjects,
        Integer totalDurationHours,
        LocalDateTime updatedAt
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
