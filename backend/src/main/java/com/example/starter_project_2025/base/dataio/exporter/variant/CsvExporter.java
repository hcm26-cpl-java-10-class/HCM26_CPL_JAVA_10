package com.example.starter_project_2025.base.dataio.exporter.variant;

import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportColumn;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportSheetConfig;
import org.springframework.stereotype.Component;

import java.io.BufferedWriter;
import java.io.IOException;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.List;

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

        // Use UTF-8 BOM so spreadsheet viewers like Excel open Vietnamese text correctly
        os.write(new byte[]{(byte) 0xEF, (byte) 0xBB, (byte) 0xBF});

        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(os, StandardCharsets.UTF_8));

        // Header
        for (int i = 0; i < config.columns().size(); i++) {
            if (i > 0) {
                writer.write(',');
            }
            writer.write(escapeCsv(config.columns().get(i).header()));
        }
        writer.newLine();

        for (T item : data) {
            for (int i = 0; i < config.columns().size(); i++) {
                if (i > 0) {
                    writer.write(',');
                }
                Object v = config.columns().get(i).valueExtractor().apply(item);
                writer.write(escapeCsv(v != null ? v.toString() : ""));
            }
            writer.newLine();
        }

        writer.flush();
    }

    private String escapeCsv(String value) {
        if (value == null) {
            return "";
        }
        boolean hasSpecial = value.indexOf(',') >= 0
                || value.indexOf('"') >= 0
                || value.indexOf('\n') >= 0
                || value.indexOf('\r') >= 0;
        if (!hasSpecial) {
            return value;
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }
}

