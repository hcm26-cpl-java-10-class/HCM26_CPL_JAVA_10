package com.example.starter_project_2025.base.dataio.exporter.component;

import lombok.Builder;

import java.util.function.Function;

@Builder
public record ExportColumn<T>(
        String header,
        Function<T, Object> valueExtractor
) {
}

