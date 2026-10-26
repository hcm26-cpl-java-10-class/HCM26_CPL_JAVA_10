package com.example.starter_project_2025.system.project.milestone.dto.response;

import java.math.BigDecimal;

public record RubricRatingOptionResponse(String level, BigDecimal percentage, String description, int orderIndex) {}

