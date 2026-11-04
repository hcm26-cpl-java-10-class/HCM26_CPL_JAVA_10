package com.example.starter_project_2025.system.trainingprogram;

import java.util.List;

public record ProgramImportPreviewResponse(
        int totalRows,
        int validRows,
        int invalidRows,
        boolean canImport,
        List<RowResult> rows
) {
    public record RowResult(
            int rowNumber,
            String programCode,
            String programVersion,
            String subjectCode,
            String subjectVersion,
            boolean valid,
            List<String> errors
    ) {}
}
