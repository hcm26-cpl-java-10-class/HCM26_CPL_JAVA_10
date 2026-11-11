package com.example.starter_project_2025.base.dataio.exporter.variant;

import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportColumn;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportSheetConfig;
import com.itextpdf.io.font.PdfEncodings;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.UnitValue;
import com.itextpdf.layout.properties.TextAlignment;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import org.springframework.stereotype.Component;

import java.io.File;
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
        PdfFont font = PdfFontFactory.createFont(resolveVietnameseFont(), PdfEncodings.IDENTITY_H);
        Document document = new Document(pdf, PageSize.A3.rotate());
        document.setFont(font);
        document.setFontSize(7);

        Table table = new Table(UnitValue.createPercentArray(config.columns().size()))
                .useAllAvailableWidth();

        for (ExportColumn<T> col : config.columns()) {
            table.addHeaderCell(new Cell().add(new Paragraph(col.header()))
                    .setTextAlignment(TextAlignment.CENTER));
        }

        for (T item : data) {
            for (ExportColumn<T> col : config.columns()) {
                Object v = col.valueExtractor().apply(item);
                table.addCell(v == null ? "" : v.toString());
            }
        }

        document.add(table);
        document.close();
    }

    private String resolveVietnameseFont() throws IOException {
        String configuredFont = System.getProperty("app.export.pdf-font");
        if (configuredFont == null || configuredFont.isBlank()) {
            configuredFont = System.getenv("APP_EXPORT_PDF_FONT");
        }

        List<String> candidates = configuredFont == null || configuredFont.isBlank()
                ? List.of(
                        "C:/Windows/Fonts/arial.ttf",
                        "C:/Windows/Fonts/segoeui.ttf",
                        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
                        "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
                        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
                        "/System/Library/Fonts/Supplemental/Arial.ttf"
                )
                : List.of(configuredFont);

        return candidates.stream()
                .map(File::new)
                .filter(File::isFile)
                .map(File::getAbsolutePath)
                .findFirst()
                .orElseThrow(() -> new IOException(
                        "No Unicode font found for PDF export. Set APP_EXPORT_PDF_FONT to a TTF font path."));
    }
}
