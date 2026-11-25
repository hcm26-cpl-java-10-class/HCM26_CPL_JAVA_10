package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record TrainingProgramRequest(
        @NotBlank @Size(max = 50) String code,
        @NotBlank @Size(max = 255) String name,
        @NotBlank @Size(max = 30) String version,
        @Size(max = 100) String region,
        @Size(max = 100) String technicalGroup,
        @Size(max = 500) String contentLink,
        @Size(max = 2000) String description,
        ProgramStatus status,
        List<@Valid ProgramSubjectRequest> subjects
) {}
