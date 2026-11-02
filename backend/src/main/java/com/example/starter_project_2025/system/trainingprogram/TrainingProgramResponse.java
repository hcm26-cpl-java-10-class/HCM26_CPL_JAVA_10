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
        java.math.BigDecimal totalDurationHours
) {
    public TrainingProgramResponse {
        totalDurationHours = com.example.starter_project_2025.system.subject.SubjectDuration.normalize(totalDurationHours);
    }
    public record ProgramSubjectResponse(
            Long id,
            Long subjectId,
            String code,
            String name,
            String version,
            java.math.BigDecimal durationHours,
            Integer orderIndex
    ) {
        public ProgramSubjectResponse {
            durationHours = com.example.starter_project_2025.system.subject.SubjectDuration.normalize(durationHours);
        }
    }
}
