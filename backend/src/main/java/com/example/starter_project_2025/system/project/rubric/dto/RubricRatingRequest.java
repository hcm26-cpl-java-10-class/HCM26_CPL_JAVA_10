package com.example.starter_project_2025.system.project.rubric.dto;

import com.example.starter_project_2025.system.project.rubric.domain.RubricRatingLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record RubricRatingRequest(
        @NotNull RubricRatingLevel level,
        @NotBlank @Size(max = 500) String description
) {}
