package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record TrainingProgramRequest(
        @NotBlank @Size(max = 50) String code,
        @NotBlank @Size(max = 255) String name,
        @NotBlank @Size(max = 30) String version,
        @Size(max = 100) String region,
        List<@Valid ProgramSubjectRequest> subjects
) {}
