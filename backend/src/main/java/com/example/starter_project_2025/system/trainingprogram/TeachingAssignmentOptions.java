package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import java.util.List;

/** Read-only filters for assignment readers, including historical shared profiles. */
public record TeachingAssignmentOptions(
        List<ExternalClassDTO> classes,
        List<ExternalTrainerDTO> trainers,
        List<SubjectOption> subjects,
        boolean sampleData
) {
    public record SubjectOption(Long id, String code, String name, String version) {}
}
