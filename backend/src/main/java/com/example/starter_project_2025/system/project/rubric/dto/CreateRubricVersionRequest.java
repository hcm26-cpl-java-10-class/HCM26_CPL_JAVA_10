package com.example.starter_project_2025.system.project.rubric.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public record CreateRubricVersionRequest(@NotNull UUID sourceVersionId) {}
