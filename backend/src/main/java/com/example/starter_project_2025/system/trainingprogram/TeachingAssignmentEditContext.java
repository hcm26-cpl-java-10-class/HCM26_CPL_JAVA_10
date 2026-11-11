package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import java.util.List;

public record TeachingAssignmentEditContext(TeachingAssignmentResponse assignment, ExternalClassDTO classProfile,
        List<ExternalTrainerDTO> trainers, long linkedSessionCount, boolean trainerLocked) {}
