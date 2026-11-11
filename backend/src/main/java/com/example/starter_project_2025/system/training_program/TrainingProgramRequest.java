package com.example.starter_project_2025.system.training_program;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public record TrainingProgramRequest(
        @NotBlank @Size(max = 50) String code,
        @NotBlank @Size(max = 150) String name,
        @NotNull @Min(1) Integer version,
        @Size(max = 100) String region,
        ProgramStatus status,
        @Valid List<ProgramSubjectRequest> subjects
) {
    public record ProgramSubjectRequest(
            @NotNull @Positive Long subjectId,
            @NotNull @Min(1) Integer orderIndex
    ) {}
}
