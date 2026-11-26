package com.example.starter_project_2025.system.demo.syllabus.importexport;

import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.junit.jupiter.api.Test;
import java.io.ByteArrayInputStream;
import static org.junit.jupiter.api.Assertions.*;

class SyllabusImportTemplateServiceTest {
    @Test void generatesFourAcademicSheetsWithoutLegacyMaterials() throws Exception {
        byte[] bytes = new SyllabusImportTemplateService().generate();
        try (Workbook workbook = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            assertEquals(4, workbook.getNumberOfSheets());
            assertEquals("Syllabuses", workbook.getSheetName(0));
            assertEquals("CLOs", workbook.getSheetName(1));
            assertEquals("Sections", workbook.getSheetName(2));
            assertEquals("Topics", workbook.getSheetName(3));
            assertEquals("Code", workbook.getSheetAt(0).getRow(0).getCell(0).getStringCellValue());
            assertEquals("Syllabus Code", workbook.getSheetAt(1).getRow(0).getCell(0).getStringCellValue());
        }
    }
}
