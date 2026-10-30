package com.example.starter_project_2025.service;

import com.example.starter_project_2025.base.dataio.importer.mapper.GenericImportMapper;
import com.example.starter_project_2025.base.dataio.importer.mapper.ValueConverter;
import com.example.starter_project_2025.base.dataio.importer.parser.ExcelParser;
import com.example.starter_project_2025.base.dataio.importer.parser.ParserFactory;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationGraphBuilder;
import com.example.starter_project_2025.base.dataio.importer.resolver.RelationLookupEngine;
import com.example.starter_project_2025.base.dataio.importer.service.GenericImportService;
import com.example.starter_project_2025.base.dataio.exporter.builder.ExportConfigBuilder;
import com.example.starter_project_2025.base.dataio.exporter.metadata.ExportMetadataCache;
import com.example.starter_project_2025.base.dataio.exporter.resolver.ExportValueResolver;
import com.example.starter_project_2025.base.dataio.exporter.resolver.RelationResolverEngine;
import com.example.starter_project_2025.base.dataio.exporter.variant.ExcelExporter;
import com.example.starter_project_2025.base.dataio.template.service.ImportTemplateService;
import com.example.starter_project_2025.system.academic.subject.SubjectRepository;
import com.example.starter_project_2025.system.study_session.StudySession;
import com.example.starter_project_2025.system.study_session.StudySessionController;
import com.example.starter_project_2025.system.study_session.StudySessionRepository;
import com.example.starter_project_2025.system.study_session.StudySessionValidator;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

// Unit tests only: in-memory XLSX files and mocked repositories, no database connection.
class StudySessionExcelImportTest {
    private static final ValidatorFactory FACTORY = Validation.buildDefaultValidatorFactory();
    private final ValueConverter converter = new ValueConverter();
    private final ExcelParser parser = new ExcelParser();

    @AfterAll
    static void closeValidatorFactory() {
        FACTORY.close();
    }

    @ParameterizedTest
    @ValueSource(strings = {"1", "1.0", " 1.000 "})
    void acceptsExactWholeNumbers(String raw) {
        assertEquals(1L, converter.convert(Long.class, raw));
        assertEquals(1L, converter.convert(long.class, raw));
    }

    @ParameterizedTest
    @ValueSource(strings = {"1.5", "invalid", "NaN", "9223372036854775808", "-9223372036854775809"})
    void rejectsInvalidFractionalOrOverflowingIds(String raw) {
        assertThrows(IllegalArgumentException.class, () -> converter.convert(Long.class, raw));
    }

    @Test
    void emptyValuesStayNullAndTextIdsKeepLongPrecision() {
        assertNull(converter.convert(Long.class, null));
        assertNull(converter.convert(Long.class, "  "));
        assertEquals(Long.MAX_VALUE, converter.convert(Long.class, "9223372036854775807.0"));
        assertEquals(Long.MIN_VALUE, converter.convert(Long.class, "-9223372036854775808"));
        assertEquals(9007199254740993L, converter.convert(Long.class, "9007199254740993"));
    }

    @Test
    void numericXmlIsNotRoundedThroughDouble() throws Exception {
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet();
            sheet.createRow(0).createCell(0).setCellValue("Subject ID");
            var cell = sheet.createRow(1).createCell(0);
            cell.setCellValue(1);
            cell.getCTCell().setV("9007199254740993");
            workbook.write(output);
            var raw = parser.parse(new ByteArrayInputStream(output.toByteArray())).getFirst().get("Subject ID");
            assertEquals("9007199254740993", raw);
            assertEquals(9007199254740993L, converter.convert(Long.class, raw));
        }
    }

    @Test
    void importsTemplateRowsAndReportsInvalidIdsWithoutSavingThem() throws Exception {
        var subjects = mock(SubjectRepository.class);
        var sessions = mock(StudySessionRepository.class);
        when(subjects.existsById(1L)).thenReturn(true);
        var controller = controller(subjects, sessions);
        var result = controller.importFile(file(1D, "1.0", 1.5D, "", "invalid"));

        assertEquals(2, result.getSuccessCount());
        assertEquals(3, result.getFailureCount());
        assertEquals(List.of(4, 5, 6), result.getErrors().stream().map(e -> e.getRowNumber()).toList());
        assertTrue(result.getErrors().get(0).getMessage().contains("whole number"));
        assertTrue(result.getErrors().get(1).getMessage().contains("Missing: Subject ID"));
        assertTrue(result.getErrors().get(2).getMessage().contains("whole number"));
        verify(sessions, times(2)).save(argThat(session -> session.getSubjectId().equals(1L)
                && session.getTitle().equals("Import conversion test")
                && session.getSessionDate().toString().equals("2026-10-19")
                && session.getStartTime().toString().equals("08:00")
                && session.getEndTime().toString().equals("09:00")));
        verify(subjects, never()).save(any());
    }

    @Test
    void blankExcelCellIsReportedAsMissingSubjectId() throws Exception {
        var subjects = mock(SubjectRepository.class);
        var sessions = mock(StudySessionRepository.class);
        var result = controller(subjects, sessions).importFile(file((Object) null));
        assertEquals(1, result.getFailureCount());
        assertTrue(result.getErrors().getFirst().getMessage().contains("Missing: Subject ID"));
        verifyNoInteractions(subjects, sessions);
    }

    @Test
    void missingSubjectReturnsReadableRowErrorBeforeAnySave() throws Exception {
        var subjects = mock(SubjectRepository.class);
        var sessions = mock(StudySessionRepository.class);
        var result = controller(subjects, sessions).importFile(file("1"));

        assertEquals(0, result.getSuccessCount());
        assertEquals(1, result.getFailureCount());
        assertEquals(2, result.getErrors().getFirst().getRowNumber());
        assertTrue(result.getErrors().getFirst().getMessage().contains("Subject ID 1 does not exist"));
        verify(subjects).existsById(1L);
        verifyNoInteractions(sessions);
        verify(subjects, never()).save(any());
    }

    @Test
    void importsApplyTheSameFieldAndTimeValidationBeforeSaving() throws Exception {
        var subjects = mock(SubjectRepository.class);
        var sessions = mock(StudySessionRepository.class);
        when(subjects.existsById(1L)).thenReturn(true);
        var controller = controller(subjects, sessions);
        for (var entry : Map.of(
                "Title", "T".repeat(151),
                "Description", "D".repeat(501),
                "Lecturer", "12345",
                "Room", "R".repeat(31),
                "End Time", "08:00",
                "Type", "PRACTICE").entrySet()) {
            var result = controller.importFile(fileWithValues(Map.of(entry.getKey(), entry.getValue()), "1"));
            assertEquals(0, result.getSuccessCount(), entry.getKey());
            assertEquals(1, result.getFailureCount(), entry.getKey());
            assertFalse(result.getErrors().getFirst().getMessage().isBlank());
        }
        var missingLecturer = controller.importFile(fileWithValues(Map.of("Lecturer", ""), "1"));
        assertTrue(missingLecturer.getErrors().getFirst().getMessage().contains("Missing: Lecturer"));
        verifyNoInteractions(sessions);
        verify(subjects, never()).save(any());
    }

    @Test
    void descriptionBoundaryAndExportedColumnsStillRoundTrip() throws Exception {
        var subjects = mock(SubjectRepository.class);
        var sessions = mock(StudySessionRepository.class);
        when(subjects.existsById(1L)).thenReturn(true);
        var controller = controller(subjects, sessions);
        var input = fileWithValues(Map.of("Description", "D".repeat(500), "Room", "Lab 301"), "1");
        var imported = controller.importFile(input);
        assertEquals(1, imported.getSuccessCount());

        var captor = org.mockito.ArgumentCaptor.forClass(StudySession.class);
        verify(sessions).save(captor.capture());
        var config = new ExportConfigBuilder(new ExportMetadataCache(),
                new ExportValueResolver(mock(RelationResolverEngine.class))).build(StudySession.class);
        try (var output = new ByteArrayOutputStream()) {
            new ExcelExporter().export(List.of(captor.getValue()), config, output);
            var rows = parser.parse(new ByteArrayInputStream(output.toByteArray()));
            assertEquals("Lab 301", rows.getFirst().get("Room"));
            assertEquals("D".repeat(500), rows.getFirst().get("Description"));
            assertEquals(1, controller.importFile(new MockMultipartFile("file", "exported.xlsx",
                    input.getContentType(), output.toByteArray())).getSuccessCount());
        }
    }

    private StudySessionController controller(SubjectRepository subjects, StudySessionRepository sessions) {
        var mapper = new GenericImportMapper(mock(RelationLookupEngine.class), mock(RelationGraphBuilder.class), converter);
        var service = new GenericImportService(new ParserFactory(List.of(parser)), mapper, mock(PasswordEncoder.class));
        return new StudySessionController(null, sessions, service, subjects,
                new StudySessionValidator(FACTORY.getValidator()));
    }

    private MockMultipartFile file(Object... ids) throws Exception {
        return fileWithValues(Map.of(), ids);
    }

    private MockMultipartFile fileWithValues(Map<String, String> values, Object... ids) throws Exception {
        byte[] template = new ImportTemplateService().generateTemplate(StudySession.class);
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(template));
             var output = new ByteArrayOutputStream()) {
            var sheet = workbook.getSheetAt(0);
            for (int index = 0; index < ids.length; index++) {
                Row row = sheet.createRow(index + 1);
                for (var header : sheet.getRow(0)) {
                    var cell = row.createCell(header.getColumnIndex());
                    if (values.containsKey(header.getStringCellValue())) {
                        cell.setCellValue(values.get(header.getStringCellValue()));
                        continue;
                    }
                    switch (header.getStringCellValue()) {
                        case "Subject ID" -> {
                            if (ids[index] == null) cell.setBlank();
                            else if (ids[index] instanceof Double number) cell.setCellValue(number);
                            else cell.setCellValue((String) ids[index]);
                        }
                        case "Title" -> cell.setCellValue("Import conversion test");
                        case "Session Date" -> cell.setCellValue("2026-10-19");
                        case "Start Time" -> cell.setCellValue("08:00");
                        case "End Time" -> cell.setCellValue("09:00");
                        case "Type" -> cell.setCellValue("LECTURE");
                        case "Lecturer" -> cell.setCellValue("Nguyễn Văn An");
                        default -> cell.setCellValue("");
                    }
                }
            }
            workbook.write(output);
            return new MockMultipartFile("file", "sessions.xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", output.toByteArray());
        }
    }
}
