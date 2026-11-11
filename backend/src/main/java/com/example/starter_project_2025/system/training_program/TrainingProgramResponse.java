package com.example.starter_project_2025.system.training_program;

import java.time.LocalDateTime;
import java.util.List;

public record TrainingProgramResponse(
        Long id, String code, String name, Integer version, String region,
        ProgramStatus status, Boolean isActive, LocalDateTime createdAt,
        List<ProgramSubjectResponse> subjects
) {
    public record ProgramSubjectResponse(Long id, Long subjectId, Integer orderIndex) {}

    public static TrainingProgramResponse from(TrainingProgram p) {
        return new TrainingProgramResponse(p.getId(), p.getCode(), p.getName(), p.getVersion(),
                p.getRegion(), p.getStatus(), p.getIsActive(), p.getCreatedAt(),
                p.getSubjects().stream()
                        .map(s -> new ProgramSubjectResponse(s.getId(), s.getSubjectId(), s.getOrderIndex()))
                        .toList());
    }
}
