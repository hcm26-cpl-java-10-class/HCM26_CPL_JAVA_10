package com.example.starter_project_2025.system.project.rubric.exception;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record RubricErrorResponse(int status, String code, String message,
                                  Map<String, List<String>> errors, Instant timestamp) {}
