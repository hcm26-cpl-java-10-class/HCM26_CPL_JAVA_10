package com.example.starter_project_2025.system.project.rubric.dto;

import com.example.starter_project_2025.system.project.rubric.domain.RubricRatingLevel;
import java.math.BigDecimal;
import java.util.UUID;

public record RubricRatingResponse(UUID id, RubricRatingLevel level, BigDecimal percentage,
                                   String description, int orderIndex) {}
