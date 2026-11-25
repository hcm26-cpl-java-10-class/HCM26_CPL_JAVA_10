package com.example.starter_project_2025.system.exam.report;

import com.itextpdf.io.font.PdfEncodings;
import com.itextpdf.io.font.constants.StandardFonts;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.geom.PageSize;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.layout.Document;
import com.itextpdf.layout.element.Cell;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.element.Table;
import com.itextpdf.layout.properties.UnitValue;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;

@Component
public class ReportFileWriter {

    static final int MAX_SHEET_NAME = 31;

    public byte[] toExcel(ReportTable table) throws IOException {
        try (Workbook workbook = new XSSFWorkbook(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            Sheet sheet = workbook.createSheet(sheetName(table.title()));
            Font bold = workbook.createFont();
            bold.setBold(true);
            CellStyle head = workbook.createCellStyle();
            head.setFont(bold);

            int r = 0;
            sheet.createRow(r++).createCell(0).setCellValue(table.title());
            for (String line : table.subtitleLines()) {
                sheet.createRow(r++).createCell(0).setCellValue(line);
            }
            r++;
            Row header = sheet.createRow(r++);
            for (int c = 0; c < table.headers().size(); c++) {
                header.createCell(c).setCellValue(table.headers().get(c));
                header.getCell(c).setCellStyle(head);
            }
            for (List<String> values : table.rows()) {
                Row row = sheet.createRow(r++);
                for (int c = 0; c < values.size(); c++) {
                    row.createCell(c).setCellValue(neutralizeFormula(values.get(c)));
                }
            }
            for (int c = 0; c < table.headers().size(); c++) {
                sheet.setColumnWidth(c, Math.min(60, Math.max(12, table.headers().get(c).length() + 4)) * 256);
            }
            workbook.write(out);
            return out.toByteArray();
        }
    }

    public byte[] toPdf(ReportTable table) throws IOException {
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            PdfDocument pdf = new PdfDocument(new PdfWriter(out));
            try (Document document = new Document(pdf, PageSize.A4.rotate())) {
                document.setMargins(20, 20, 20, 20);
                document.setFont(createFont());
                document.add(new Paragraph(table.title()).setFontSize(18).setBold());
                for (String line : table.subtitleLines()) {
                    document.add(new Paragraph(line).setFontSize(10));
                }
                int columns = Math.max(1, table.headers().size());
                Table pdfTable = new Table(UnitValue.createPercentArray(columns)).useAllAvailableWidth();
                for (String h : table.headers()) {
                    pdfTable.addHeaderCell(new Cell().add(new Paragraph(h).setBold().setFontSize(8)));
                }
                for (List<String> values : table.rows()) {
                    for (int c = 0; c < columns; c++) {
                        String v = c < values.size() ? values.get(c) : "";
                        pdfTable.addCell(new Cell().add(new Paragraph(v == null ? "" : v).setFontSize(8)));
                    }
                }
                document.add(pdfTable);
            }
            return out.toByteArray();
        }
    }

    /** Stops spreadsheet apps from running a cell as a formula when it starts with = + - @. */
    static String neutralizeFormula(String value) {
        if (value == null) {
            return "";
        }
        if (!value.isEmpty() && "=+-@".indexOf(value.charAt(0)) >= 0 && !isNumber(value)) {
            return "'" + value;
        }
        return value;
    }

    private static boolean isNumber(String v) {
        try {
            Double.parseDouble(v);
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    static String sheetName(String title) {
        String clean = title == null ? "Report" : title.replaceAll("[\\\\/?*\\[\\]:]", " ").trim();
        if (clean.isEmpty()) {
            clean = "Report";
        }
        return clean.length() > MAX_SHEET_NAME ? clean.substring(0, MAX_SHEET_NAME) : clean;
    }

    private PdfFont createFont() throws IOException {
        try (InputStream stream = getClass().getResourceAsStream("/fonts/DejaVuSans.ttf")) {
            if (stream != null) {
                return PdfFontFactory.createFont(stream.readAllBytes(), PdfEncodings.IDENTITY_H);
            }
        }
        try {
            return PdfFontFactory.createFont("C:/Windows/Fonts/arial.ttf", PdfEncodings.IDENTITY_H);
        } catch (IOException ignored) {
            return PdfFontFactory.createFont(StandardFonts.HELVETICA);
        }
    }
}
