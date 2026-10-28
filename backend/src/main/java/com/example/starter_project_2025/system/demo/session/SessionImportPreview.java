package com.example.starter_project_2025.system.demo.session;

import java.util.List;
import java.util.Map;

public record SessionImportPreview(int totalRows, int validRows, int invalidRows, boolean canImport,
                                   List<String> columns, List<Row> rows, List<String> requiredColumns,
                                   List<String> warnings, List<String> rules) {
    public record Row(int rowNumber, Map<String, String> values, boolean valid, List<String> errors) {}
}
