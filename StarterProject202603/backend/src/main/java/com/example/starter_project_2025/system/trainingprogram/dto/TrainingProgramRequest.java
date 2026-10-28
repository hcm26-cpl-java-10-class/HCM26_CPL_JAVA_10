package com.example.trainingprogram.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record TrainingProgramRequest(
    @NotBlank @Size(max = 80) String code,
    @NotBlank @Size(max = 200) String name,
    @NotBlank @Size(max = 40) String version,
    @Size(max = 100) String region,
    @NotEmpty List<@Valid ProgramSubjectRequest> subjects
) {}
