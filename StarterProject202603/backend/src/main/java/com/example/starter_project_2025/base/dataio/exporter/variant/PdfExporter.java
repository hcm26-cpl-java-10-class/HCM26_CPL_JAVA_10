package com.example.starter_project_2025.base.dataio.exporter.variant;

import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportColumn;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportSheetConfig;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Table;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.OutputStream;
import java.util.List;

@Component
public class PdfExporter implements Exporter {

    @Override
    public FileFormat format() {
        return FileFormat.PDF;
    }

    @Override
    public <T> void export(
            List<T> data,
            ExportSheetConfig<T> config,
            OutputStream os
    ) throws IOException {

        PdfWriter writer = new PdfWriter(os);
        PdfDocument pdf = new PdfDocument(writer);
        Document document = new Document(pdf);

        Table table = new Table(config.columns().size());

        // Header
        for (ExportColumn<T> col : config.columns()) {
            table.addHeaderCell(col.header());
        }

        // Data
        for (T item : data) {
            for (ExportColumn<T> col : config.columns()) {
                Object v = col.valueExtractor().apply(item);
                table.addCell(v != null ? v.toString() : "");
            }
        }

        document.add(table);
        document.close();
    }
}


