package com.example.starter_project_2025.base.dataio.exporter.variant;

import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportColumn;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportSheetConfig;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.OutputStream;
import java.io.BufferedWriter;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class CsvExporter implements Exporter {

    @Override
    public FileFormat format() {
        return FileFormat.CSV;
    }

    @Override
    public <T> void export(
            List<T> data,
            ExportSheetConfig<T> config,
            OutputStream os
    ) throws IOException {

        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(os, StandardCharsets.UTF_8));

        // Header
        writer.write(
                config.columns().stream()
                        .map(ExportColumn::header)
                        .map(this::escape)
                        .collect(Collectors.joining(","))
        );
        writer.write("\r\n");

        // Data
        for (T item : data) {
            String line = config.columns().stream()
                    .map(c -> {
                        Object v = c.valueExtractor().apply(item);
                        return v != null ? v.toString() : "";
                    })
                    .map(this::escape)
                    .collect(Collectors.joining(","));

            writer.write(line);
            writer.write("\r\n");
        }

        writer.flush();
    }

    private String escape(String value) {
        if (value.indexOf(',') >= 0 || value.indexOf('"') >= 0
                || value.indexOf('\r') >= 0 || value.indexOf('\n') >= 0) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}


