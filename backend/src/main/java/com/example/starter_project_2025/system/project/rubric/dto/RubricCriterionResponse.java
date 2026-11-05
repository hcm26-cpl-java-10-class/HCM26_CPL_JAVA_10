package com.example.starter_project_2025.system.project.rubric.dto;

import java.math.BigDecimal;
import java.util.UUID;
import java.util.List;

public record RubricCriterionResponse(UUID id, String code, String name, String description,
                                      BigDecimal weight, BigDecimal maxScore, int orderIndex,
                                      List<RubricRatingResponse> ratings) {}
