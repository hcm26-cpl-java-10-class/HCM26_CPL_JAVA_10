package com.example.starter_project_2025.system.exam.report;

import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReportFileWriterTest {

    private final ReportFileWriter writer = new ReportFileWriter();
    private final ReportTable table = new ReportTable("Gradebook: A/B",
            List.of("Course: X"), List.of("Name", "Score"),
            List.of(List.of("=cmd()", "8.5"), List.of("Lan", "-1")));

    @Test
    void excelHasTitleHeaderAndRowsWithFormulasNeutralized() throws Exception {
        byte[] bytes = writer.toExcel(table);
        try (Workbook wb = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            Sheet sheet = wb.getSheetAt(0);
            assertEquals("Gradebook  A B", sheet.getSheetName());
            assertEquals("Gradebook: A/B", sheet.getRow(0).getCell(0).getStringCellValue());
            assertEquals("Name", sheet.getRow(3).getCell(0).getStringCellValue());
            assertEquals("'=cmd()", sheet.getRow(4).getCell(0).getStringCellValue());
            assertEquals("-1", sheet.getRow(5).getCell(1).getStringCellValue());
        }
    }

    @Test
    void pdfIsGenerated() throws Exception {
        byte[] bytes = writer.toPdf(table);
        assertTrue(bytes.length > 500);
        assertEquals("%PDF", new String(bytes, 0, 4));
    }

    @Test
    void longSheetNamesAreTruncated() {
        assertEquals(31, ReportFileWriter.sheetName("x".repeat(80)).length());
    }
}
