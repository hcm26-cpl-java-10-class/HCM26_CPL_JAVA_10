package com.example.starter_project_2025.base.dataio.exporter.variant;

import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportColumn;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportSheetConfig;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintWriter;
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

        PrintWriter writer = new PrintWriter(os);

        // Header
        writer.println(
                config.columns().stream()
                        .map(ExportColumn::header)
                        .collect(Collectors.joining(","))
        );

        // Data
        for (T item : data) {
            String line = config.columns().stream()
                    .map(c -> {
                        Object v = c.valueExtractor().apply(item);
                        return v != null ? v.toString() : "";
                    })
                    .collect(Collectors.joining(","));

            writer.println(line);
        }

        writer.flush();
    }
}


