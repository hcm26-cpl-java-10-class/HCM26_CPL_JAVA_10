package com.example.starter_project_2025.system.project.rubric.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

public record RubricCriterionRequest(
        @NotBlank @Size(max = 30) String code,
        @NotBlank @Size(max = 100) String name,
        @Size(max = 500) String description,
        @NotNull @DecimalMin(value = "0.01") @DecimalMax(value = "100.00")
        @Digits(integer = 3, fraction = 2) BigDecimal weight,
        @NotNull @DecimalMin(value = "0.01") @Digits(integer = 8, fraction = 2) BigDecimal maxScore,
        @NotNull @Min(0) Integer orderIndex,
        @NotEmpty @Size(min = 4, max = 4) List<@Valid RubricRatingRequest> ratings
) {}
