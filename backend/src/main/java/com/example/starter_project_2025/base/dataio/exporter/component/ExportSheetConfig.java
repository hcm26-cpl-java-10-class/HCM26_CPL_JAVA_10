package com.example.starter_project_2025.base.dataio.exporter.component;

import lombok.Builder;

import java.util.List;

@Builder
public record ExportSheetConfig<T>(
        String sheetName,
        List<ExportColumn<T>> columns
) {
}
