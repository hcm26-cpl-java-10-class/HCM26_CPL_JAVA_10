package com.example.starter_project_2025.system.subject;

import java.util.List;
import java.util.Map;

public record SubjectImportPreview(int totalRows, long validRows, long invalidRows, List<Row> rows) {
    public record Row(int rowNumber, SubjectDTO data, List<String> errors, Map<String, String> values) {
        public boolean isValid() { return errors.isEmpty(); }
    }
}
