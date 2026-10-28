package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import java.util.List;

public record TeachingAssignmentCreateOptions(
        List<ExternalClassDTO> classes,
        List<ExternalTrainerDTO> trainers,
        boolean sampleData
) {
    public record ClassContext(
            ExternalClassDTO classProfile,
            ClassProgramSubjectsResponse.ProgramSummary program,
            List<SubjectOption> subjects
    ) {}

    public record SubjectOption(Long programSubjectId, Long subjectId, String code, String name, String version) {}
}
