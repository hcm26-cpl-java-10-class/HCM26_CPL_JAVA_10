package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.dataio.importer.mapper.*;
import com.example.starter_project_2025.base.dataio.importer.parser.*;
import com.example.starter_project_2025.base.dataio.importer.resolver.*;
import com.example.starter_project_2025.system.schedule.*;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SessionImportServiceTest {
    private final SessionImportCoordinator sessions = mock(SessionImportCoordinator.class);
    private final ValueConverter converter = new ValueConverter();
    private final SessionImportService imports = new SessionImportService(
            new ParserFactory(List.of(new ExcelParser(), new CsvParser())),
            converter, new SessionMapperImpl(), sessions, new ScheduleRules());

    @BeforeEach void setup() {
        when(sessions.previewValidatedBatch(anyList())).thenReturn(new ScheduleValidationResult(true, "Asia/Ho_Chi_Minh", List.of()));
    }

    @ParameterizedTest @ValueSource(strings = {"1", "1.0", " 1.000 "})
    void acceptsWholeNumberIdsWithoutRounding(String value) {
        assertEquals(1L, converter.convert(Long.class, value));
        assertEquals(1, converter.convert(Integer.class, value));
    }

    @ParameterizedTest @ValueSource(strings = {"1.5", "NaN", "invalid", "9223372036854775808", "-9223372036854775809"})
    void rejectsFractionalInvalidAndOverflowingIds(String value) {
        assertThrows(IllegalArgumentException.class, () -> converter.convert(Long.class, value));
    }

    @Test void preservesLongPrecisionAndRejectsIntegerOverflow() {
        assertEquals(9007199254740993L, converter.convert(Long.class, "9007199254740993.0"));
        assertEquals(Long.MAX_VALUE, converter.convert(Long.class, "9223372036854775807.0"));
        assertThrows(IllegalArgumentException.class, () -> converter.convert(Integer.class, "2147483648"));
        assertThrows(IllegalArgumentException.class, () -> converter.convert(Integer.class, "1.5"));
    }

    @Test void convertsExcelAndTextDateTimesWithoutChangingTimezones() {
        assertEquals(LocalDateTime.of(2026,10,28,9,0), converter.convert(LocalDateTime.class, "2026-10-28 09:00"));
        assertEquals(LocalDate.of(2026,10,28), converter.convert(LocalDate.class, "2026-10-28T00:00:00"));
        assertEquals(LocalTime.of(9,0), converter.convert(LocalTime.class, "09:00"));
        assertTrue(assertThrows(IllegalArgumentException.class, () -> converter.convert(LocalDateTime.class, "28/10/2026 09:00"))
                .getMessage().contains("yyyy-MM-ddTHH:mm"));
    }

    @Test void previewNormalizesExcelNumbersDatesAndFormulasWithoutSaving() throws Exception {
        for (boolean legacy : List.of(false, true)) {
            var preview = imports.preview(excel(legacy));
            assertTrue(preview.canImport());
            assertEquals(1, preview.validRows());
            assertEquals("1", preview.rows().getFirst().values().get("Class ID"));
            assertEquals("1", preview.rows().getFirst().values().get("Trainer ID"));
            assertEquals("2026-10-28T09:00", preview.rows().getFirst().values().get("Start Time"));
            assertEquals("2026-10-28T10:00", preview.rows().getFirst().values().get("End Time"));
        }
        verify(sessions, never()).createValidatedBatch(anyList());
    }

    @Test void rawXmlNumericIdsAreNotRoundedThroughDouble() throws Exception {
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet(); sheet.createRow(0).createCell(0).setCellValue("Class ID");
            var cell = sheet.createRow(1).createCell(0); cell.setCellValue(1); cell.getCTCell().setV("9007199254740993");
            workbook.write(output);
            assertEquals("9007199254740993", new ExcelParser().parse(new ByteArrayInputStream(output.toByteArray())).getFirst().get("Class ID"));
        }
    }

    @Test void csvBomAndDecimalIdsUseTheSamePreviewAndImportPath() {
        var file = csv("1.0", "1.0");
        var preview = imports.preview(file);
        assertEquals(2, preview.validRows());
        assertEquals("1", preview.rows().getFirst().values().get("Class ID"));
        verify(sessions, never()).createValidatedBatch(anyList());
        assertEquals(2, imports.importFile(file).getSuccessCount());
        verify(sessions).createValidatedBatch(argThat(rows -> rows.size() == 2 && rows.getFirst().getClassId().equals(1L)));
    }

    @Test void fractionalIdExplainsColumnAndBlocksEveryWrite() {
        var file = csv("1.5", "1.0");
        var preview = imports.preview(file);
        assertFalse(preview.canImport());
        assertEquals(1, preview.invalidRows());
        assertEquals(2, preview.rows().getFirst().rowNumber());
        assertTrue(preview.rows().getFirst().errors().getFirst().contains("Class ID: Expected a whole number"));
        var result = imports.importFile(file);
        assertEquals(0, result.getSuccessCount());
        assertEquals(2, result.getFailureCount());
        verify(sessions, never()).createValidatedBatch(anyList());
    }

    @Test void validationKeepsOriginalRowsWhenEarlierRowsCannotBeParsed() {
        when(sessions.previewValidatedBatch(anyList())).thenReturn(new ScheduleValidationResult(false, "Asia/Ho_Chi_Minh", List.of(
                new ScheduleIssue("CLASS_CONFLICT", "classId", "Class overlap", 0, 1, null, null, null, null))));
        var preview = imports.preview(csv("invalid", "1.0", "1.0"));
        assertTrue(preview.rows().get(1).errors().contains("Class overlap (row 4)"));
        assertTrue(preview.rows().get(2).errors().isEmpty());
        assertFalse(preview.canImport());
        verify(sessions, never()).createValidatedBatch(anyList());
    }

    @Test void batchLevelValidationAppliesToEveryRow() {
        when(sessions.previewValidatedBatch(anyList())).thenReturn(new ScheduleValidationResult(false, "Asia/Ho_Chi_Minh", List.of(
                new ScheduleIssue("SOURCE_UNAVAILABLE", "sessions", "Reference service unavailable", -1, null, null, null, null, null))));
        var preview = imports.preview(csv("1", "1"));
        assertEquals(2, preview.invalidRows());
        assertTrue(preview.rows().stream().allMatch(row -> row.errors().contains("Reference service unavailable")));
    }

    @Test void finalConfirmationRechecksConflictsThatAppearedAfterPreview() {
        var file = csv("1");
        assertTrue(imports.preview(file).canImport());
        when(sessions.createValidatedBatch(anyList())).thenThrow(new ScheduleValidationException(new ScheduleValidationResult(false,
                "Asia/Ho_Chi_Minh", List.of(new ScheduleIssue("CLASS_CONFLICT", "classId", "Class is already booked", 0, null, 9L, null, null, null)))));
        var result = imports.importFile(file);
        assertEquals(0, result.getSuccessCount());
        assertEquals(1, result.getFailureCount());
        assertEquals(2, result.getErrors().getFirst().getRowNumber());
        assertTrue(result.getErrors().getFirst().getMessage().contains("session #9"));
    }

    @Test void emptyAndUnsupportedFilesAreRejectedBeforeValidation() {
        assertThrows(IllegalArgumentException.class, () -> imports.preview(new MockMultipartFile("file", "empty.csv", "text/csv", new byte[0])));
        assertThrows(IllegalArgumentException.class, () -> imports.preview(new MockMultipartFile("file", "data.txt", "text/plain", new byte[]{1})));
        verifyNoInteractions(sessions);
    }

    @Test void wrongTemplateReportsEveryMissingFieldAndDoesNotGuessTopicOrTrainer() {
        var file = new MockMultipartFile("file", "study-sessions.csv", "text/csv",
                "Class ID,Subject ID,Session Date\n1,99,2026-10-28\n".getBytes(StandardCharsets.UTF_8));
        var preview = imports.preview(file);
        assertFalse(preview.canImport());
        assertEquals(5, preview.rows().getFirst().errors().size());
        assertTrue(preview.rows().getFirst().errors().containsAll(List.of("Missing: Topic ID", "Missing: Trainer ID", "Missing: Session Title", "Missing: Start Time", "Missing: End Time")));
        assertTrue(preview.warnings().stream().anyMatch(message -> message.contains("Study Sessions")));
        assertEquals("", preview.rows().getFirst().values().get("Topic ID"));
        verify(sessions, never()).createValidatedBatch(anyList());
    }

    @Test void normalizesHeaderCaseAndWhitespaceButRejectsDuplicateColumns() {
        var text = " class  id ,topic id, trainer id, session title, start time,end time,room id\n1,1,1,Java session,2026-10-28 09:00,2026-10-28 10:00,1\n";
        var preview = imports.preview(new MockMultipartFile("file", "session.csv", "text/csv", text.getBytes(StandardCharsets.UTF_8)));
        assertTrue(preview.canImport());
        assertEquals("1", preview.rows().getFirst().values().get("Class ID"));
        assertTrue(preview.warnings().isEmpty());
        var duplicate = new MockMultipartFile("file", "duplicate.csv", "text/csv", "Class ID,class id\n1,2\n".getBytes(StandardCharsets.UTF_8));
        assertTrue(assertThrows(RuntimeException.class, () -> imports.preview(duplicate)).getMessage().contains("Duplicate column"));
    }

    @Test void rechecksAndSavesCorrectedValuesWithoutRereadingTheOriginalFile() {
        assertFalse(imports.preview(csv("1.5")).canImport());
        var corrected = new SessionImportRowsRequest(List.of(editedRow(17, Map.of("Class ID", "1.0", "Session Title", "Corrected title"))));
        var preview = imports.previewRows(corrected);
        assertTrue(preview.canImport());
        assertEquals(17, preview.rows().getFirst().rowNumber());
        assertEquals("1", preview.rows().getFirst().values().get("Class ID"));
        verify(sessions, never()).createValidatedBatch(anyList());
        assertEquals(1, imports.importRows(corrected).getSuccessCount());
        verify(sessions).createValidatedBatch(argThat(rows -> rows.getFirst().getTitle().equals("Corrected title") && rows.getFirst().getClassId().equals(1L)));
    }

    @ParameterizedTest @ValueSource(strings = {"0", "-1", "1.5", "9223372036854775808"})
    void invalidEditedIdsCannotBypassServerValidation(String value) {
        var edited = new SessionImportRowsRequest(List.of(editedRow(8, Map.of("Class ID", value))));
        assertFalse(imports.previewRows(edited).canImport());
        assertEquals(0, imports.importRows(edited).getSuccessCount());
        verify(sessions, never()).createValidatedBatch(anyList());
    }

    @Test void reportsAllFieldLengthAndDateErrorsTogether() {
        var edited = new SessionImportRowsRequest(List.of(editedRow(2, Map.of(
                "Session Title", "T".repeat(151), "Location / Room", "R".repeat(151),
                "Meeting URL", "https://example.com/" + "a".repeat(1000), "Start Time", "2026-02-30T09:00"))));
        var errors = imports.previewRows(edited).rows().getFirst().errors();
        for (var column : List.of("Session Title", "Location / Room", "Meeting URL", "Start Time")) {
            assertTrue(errors.stream().anyMatch(message -> message.startsWith(column + ":")), column);
        }
        verify(sessions, never()).createValidatedBatch(anyList());
    }

    @ParameterizedTest @ValueSource(strings = {"https://", "ftp://example.com/session", "javascript:alert(1)", "not a URL"})
    void rejectsMalformedMeetingUrlEvenWhenRoomIsPresent(String value) {
        var preview = imports.previewRows(new SessionImportRowsRequest(List.of(editedRow(2, Map.of("Meeting URL", value)))));
        assertFalse(preview.canImport());
        assertTrue(preview.rows().getFirst().errors().getFirst().startsWith("Meeting URL:"));
    }

    @Test void rejectsReversedTimesAndAcceptsIsoTimesWithSeconds() {
        assertFalse(imports.previewRows(new SessionImportRowsRequest(List.of(editedRow(2, Map.of("End Time", "2026-10-28T08:59"))))).canImport());
        assertTrue(imports.previewRows(new SessionImportRowsRequest(List.of(editedRow(2, Map.of("Start Time", "2026-10-28T09:00:30"))))).canImport());
    }

    @Test void editedRowNumbersRemainStableInPreviewAndFinalRaceErrors() {
        var edited = new SessionImportRowsRequest(List.of(editedRow(7, Map.of()), editedRow(29, Map.of())));
        var issue = new ScheduleIssue("CLASS_CONFLICT", "classId", "Class overlap", 1, 0, null, null, null, null);
        when(sessions.previewValidatedBatch(anyList())).thenReturn(new ScheduleValidationResult(false, "Asia/Ho_Chi_Minh", List.of(issue)));
        var preview = imports.previewRows(edited);
        assertEquals(29, preview.rows().get(1).rowNumber());
        assertTrue(preview.rows().get(1).errors().contains("Class overlap (row 7)"));
        when(sessions.previewValidatedBatch(anyList())).thenReturn(new ScheduleValidationResult(true, "Asia/Ho_Chi_Minh", List.of()));
        when(sessions.createValidatedBatch(anyList())).thenThrow(new ScheduleValidationException(new ScheduleValidationResult(false, "Asia/Ho_Chi_Minh", List.of(issue))));
        var result = imports.importRows(edited);
        assertEquals(0, result.getSuccessCount());
        assertEquals(29, result.getErrors().getFirst().getRowNumber());
        assertTrue(result.getErrors().getFirst().getMessage().contains("row 7"));
    }

    @Test void rejectsDuplicateRowNumbersUnknownColumnsOversizedAndEmptyRequests() {
        assertThrows(IllegalArgumentException.class, () -> imports.previewRows(new SessionImportRowsRequest(List.of())));
        assertThrows(IllegalArgumentException.class, () -> imports.previewRows(new SessionImportRowsRequest(List.of(editedRow(2, Map.of()), editedRow(2, Map.of())))));
        assertThrows(IllegalArgumentException.class, () -> imports.previewRows(new SessionImportRowsRequest(List.of(editedRow(1, Map.of())))));
        assertThrows(IllegalArgumentException.class, () -> imports.previewRows(new SessionImportRowsRequest(List.of(editedRow(2, Map.of("Status", "COMPLETED"))))));
        assertThrows(IllegalArgumentException.class, () -> imports.previewRows(new SessionImportRowsRequest(List.of(editedRow(2, Map.of("Session Title", "X".repeat(2049)))))));
        var tooMany = java.util.stream.IntStream.range(2, 203).mapToObj(index -> editedRow(index, Map.of())).toList();
        assertThrows(IllegalArgumentException.class, () -> imports.previewRows(new SessionImportRowsRequest(tooMany)));
        verify(sessions, never()).createValidatedBatch(anyList());
    }

    @Test void previewRulesUseTheConfiguredWorkingHoursAndBatchLimit() {
        var rules = new ScheduleRules(); rules.setOpeningTime(LocalTime.of(8,0)); rules.setClosingTime(LocalTime.of(18,0)); rules.setMaxBatchSize(20);
        var service = new SessionImportService(new ParserFactory(List.of(new ExcelParser(), new CsvParser())), converter, new SessionMapperImpl(), sessions, rules);
        var preview = service.previewRows(new SessionImportRowsRequest(List.of(editedRow(2, Map.of()))));
        assertTrue(preview.rules().stream().anyMatch(rule -> rule.contains("08:00") && rule.contains("18:00")));
        assertTrue(preview.rules().stream().anyMatch(rule -> rule.contains("at most 20")));
    }

    private SessionImportRowsRequest.Row editedRow(int number, Map<String, String> overrides) {
        var values = new LinkedHashMap<>(Map.of("Class ID", "1", "Topic ID", "1", "Trainer ID", "1", "Room ID", "1",
                "Session Title", "Java session", "Start Time", "2026-10-28T09:00", "End Time", "2026-10-28T10:00"));
        values.putAll(overrides);
        return new SessionImportRowsRequest.Row(number, values);
    }
    private MockMultipartFile csv(String... ids) {
        StringBuilder text = new StringBuilder("\uFEFFClass ID,Topic ID,Trainer ID,Session Title,Start Time,End Time,Location / Room\n");
        for (String id : ids) text.append(id).append(",1.0,1.0,Java session,2026-10-28T09:00,2026-10-28T10:00,A101\n");
        return new MockMultipartFile("file", "SESSIONS.CSV", "text/csv", text.toString().getBytes(StandardCharsets.UTF_8));
    }

    private MockMultipartFile excel(boolean legacy) throws Exception {
        try (Workbook workbook = legacy ? new HSSFWorkbook() : new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet(); var header = sheet.createRow(0);
            var columns = List.of("Class ID", "Topic ID", "Trainer ID", "Session Title", "Start Time", "End Time", "Location / Room");
            for (int index = 0; index < columns.size(); index++) header.createCell(index).setCellValue(columns.get(index));
            var row = sheet.createRow(1); row.createCell(0).setCellValue(1D); row.createCell(1).setCellValue("1.0");
            row.createCell(2).setCellFormula("1+0"); row.createCell(3).setCellValue("Java session");
            var style = workbook.createCellStyle(); style.setDataFormat(workbook.createDataFormat().getFormat("yyyy-mm-dd hh:mm"));
            row.createCell(4).setCellValue(LocalDateTime.of(2026,10,28,9,0)); row.getCell(4).setCellStyle(style);
            row.createCell(5).setCellValue(LocalDateTime.of(2026,10,28,10,0)); row.getCell(5).setCellStyle(style);
            row.createCell(6).setCellValue("A101"); workbook.write(output);
            return new MockMultipartFile("file", legacy ? "SESSIONS.XLS" : "sessions.xlsx", "application/octet-stream", output.toByteArray());
        }
    }
}
