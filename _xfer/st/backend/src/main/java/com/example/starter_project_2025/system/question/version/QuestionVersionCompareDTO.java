package com.example.starter_project_2025.system.question.version;

import java.util.List;

public record QuestionVersionCompareDTO(int fromVersion, int toVersion, List<FieldChange> changes) {

    public record FieldChange(String field, String before, String after) {
    }
}
