package com.example.starter_project_2025.system.subject.dto;

import java.util.List;

public record TopicImportPreviewResponse(
        int totalRows,
        int validRows,
        int invalidRows,
        boolean canImport,
        List<RowResult> rows
) {
    public record RowResult(
            int rowNumber,
            String code,
            String name,
            String version,
            String technicalGroup,
            Integer durationHours,
            String description,
            String status,
            boolean valid,
            List<String> errors
    ) {}
}

