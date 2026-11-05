package com.example.starter_project_2025.system.project.rubric.dto;

import java.util.List;

public record RubricPageResponse(List<RubricListItemResponse> content, int page, int size,
                                 long totalElements, int totalPages) {}
