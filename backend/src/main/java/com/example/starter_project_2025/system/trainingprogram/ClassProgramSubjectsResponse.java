package com.example.starter_project_2025.system.trainingprogram;

import java.util.List;

public record ClassProgramSubjectsResponse(
        Long classId,
        String classCode,
        String className,
        ProgramSummary program,
        List<ProgramSubjectItem> subjects
) {
    public record ProgramSummary(
            Long id,
            String code,
            String name,
            String version,
            ProgramStatus status
    ) {}

    public record ProgramSubjectItem(
            Long programSubjectId,
            Long subjectId,
            String subjectCode,
            String subjectName,
            Integer durationHours,
            Integer orderIndex,
            List<TeachingAssignmentResponse> assignments
    ) {}
}
