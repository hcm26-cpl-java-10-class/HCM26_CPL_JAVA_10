package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CalendarExcelExporterTest {
    private final ExternalApiService service = mock(ExternalApiService.class);
    private final ObjectMapper mapper = new ObjectMapper();
    private final CalendarExcelExporter exporter = new CalendarExcelExporter(service, mapper);

    @Test
    void exportsFormattedCalendarWithActualTimesAndTopicMetadata() throws Exception {
        var calendar = mapper.readTree("""
                {"id":109,"name":"Java Calendar","version":"1.9","status":"active",
                 "sessions":[{"id":1,"topic":"Problem Solving","topicCode":"L1_AL_PSE","topicVersion":"1.0",
                   "date":"2026-05-26","slot":"Morning (08:30-12:00)","room":"Room 101","trainer":"Trainer",
                   "notes":"Problem Solving (E-learning)","staffType":"Internal","trainingMaterials":"Workbook"}]}
                """);
        when(service.fetchClassCalendars(1L)).thenReturn(mapper.createArrayNode().add(calendar));
        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(exporter.export(1L, 109L)))) {
            Sheet sheet = workbook.getSheet("Training Calendar");
            assertNotNull(sheet);
            assertEquals(1, workbook.getNumberOfSheets());
            assertEquals("Venue", sheet.getRow(4).getCell(8).getStringCellValue());
            assertEquals("Training Materials", sheet.getRow(4).getCell(13).getStringCellValue());
            assertEquals(IndexedColors.GREY_50_PERCENT.getIndex(), sheet.getRow(5).getCell(11).getCellStyle().getFillForegroundColor());
            Row detail = sheet.getRow(6);
            assertEquals("L1_AL_PSE", detail.getCell(11).getStringCellValue());
            assertEquals("1.0", detail.getCell(12).getStringCellValue());
            assertEquals("Room 101", detail.getCell(8).getStringCellValue());
            assertEquals("Workbook", detail.getCell(13).getStringCellValue());
            assertEquals(8.5 / 24, detail.getCell(3).getNumericCellValue(), 0.00001);
            assertEquals(3.5, detail.getCell(5).getNumericCellValue(), 0.00001);
            assertEquals(BorderStyle.THIN, detail.getCell(9).getCellStyle().getBorderBottom());
            assertTrue(detail.getCell(9).getCellStyle().getWrapText());
            assertEquals(5, sheet.getPaneInformation().getHorizontalSplitPosition());
        }
    }

    @Test
    void calendarRangesDoNotInventDetailedTimes() throws Exception {
        var calendar = mapper.readTree("""
                {"name":"Snapshot","overviewItems":[{"label":"[OC]","startDate":"2026-05-25","endDate":"2026-05-25"}],"sessions":[]}
                """);
        try (Workbook workbook = new XSSFWorkbook(new ByteArrayInputStream(exporter.build(calendar)))) {
            Row row = workbook.getSheetAt(0).getRow(6);
            assertEquals("OC", row.getCell(11).getStringCellValue());
            assertEquals("", row.getCell(3).getStringCellValue());
            assertEquals("", row.getCell(4).getStringCellValue());
            assertEquals("", row.getCell(12).getStringCellValue());
        }
    }

    @Test
    void rejectsCalendarNotOwnedByRequestedClass() {
        when(service.fetchClassCalendars(2L)).thenReturn(java.util.List.of(java.util.Map.of("id", 209)));
        assertThrows(ResourceNotFoundException.class, () -> exporter.export(2L, 109L));
    }
}
