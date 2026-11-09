package com.example.starter_project_2025.system.project.rubric.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public record SaveRubricDraftRequest(
        @NotBlank @Size(max = 50) String name,
        @Size(max = 500) String description,
        @NotEmpty @Size(max = 100) List<@Valid RubricCriterionRequest> criteria
) {}
