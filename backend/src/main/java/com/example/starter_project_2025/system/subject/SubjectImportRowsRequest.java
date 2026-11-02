package com.example.starter_project_2025.system.subject;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public record SubjectImportRowsRequest(
        @NotEmpty @Size(max = SubjectImportReader.MAX_ROWS) List<@NotNull @Valid Row> rows) {
    public record Row(@Min(2) int rowNumber, @NotEmpty @Size(max = 64) Map<@NotNull String, String> values) {}
}
