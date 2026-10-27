package com.example.starter_project_2025.service;

import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportColumn;
import com.example.starter_project_2025.base.dataio.exporter.component.ExportSheetConfig;
import com.example.starter_project_2025.base.dataio.exporter.service.ExportService;
import com.example.starter_project_2025.base.dataio.exporter.variant.CsvExporter;
import com.example.starter_project_2025.base.dataio.exporter.variant.PdfExporter;
import com.example.starter_project_2025.system.study_session.dataio.StudySessionValueConverter;
import com.example.starter_project_2025.system.study_session.dataio.StudySessionCsvParser;
import com.example.starter_project_2025.system.study_session.dataio.StudySessionExcelParser;
import com.example.starter_project_2025.system.study_session.StudySessionImportService;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.study_session.*;
import com.itextpdf.kernel.pdf.*;
import com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.*;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;
import java.io.*;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudySessionDataIoRegressionTest {
    @Test
    void csvRoundTripsVietnameseQuotesCommasAndMultilineText() throws Exception {
        String text = "Buổi học, tiếng Việt \"Java\"\nDòng thứ hai";
        var config = new ExportSheetConfig<String>("Sessions", List.of(new ExportColumn<>("Title", value -> value)));
        var output = new ByteArrayOutputStream();
        new CsvExporter().export(List.of(text), config, output);
        var rows = new StudySessionCsvParser().parse(new ByteArrayInputStream(output.toByteArray()));
        assertEquals(text, rows.getFirst().get("Title"));
    }

    @Test
    void excelDateAndTimeCellsConvertIntoSessionValues() throws Exception {
        try (var workbook = new XSSFWorkbook(); var output = new ByteArrayOutputStream()) {
            var sheet = workbook.createSheet();
            var header = sheet.createRow(0);
            header.createCell(0).setCellValue("Session Date");
            header.createCell(1).setCellValue("Start Time");
            var row = sheet.createRow(1);
            var date = row.createCell(0);
            date.setCellValue(LocalDateTime.of(2026, 10, 26, 0, 0));
            var dateStyle = workbook.createCellStyle();
            dateStyle.setDataFormat(workbook.createDataFormat().getFormat("yyyy-mm-dd"));
            date.setCellStyle(dateStyle);
            var time = row.createCell(1);
            time.setCellValue(8.0 / 24);
            var timeStyle = workbook.createCellStyle();
            timeStyle.setDataFormat(workbook.createDataFormat().getFormat("hh:mm"));
            time.setCellStyle(timeStyle);
            workbook.write(output);
            var values = new StudySessionExcelParser().parse(new ByteArrayInputStream(output.toByteArray())).getFirst();
            var converter = new StudySessionValueConverter();
            assertEquals(LocalDate.of(2026, 10, 26), converter.convert(LocalDate.class, values.get("Session Date")));
            assertEquals(LocalTime.of(8, 0), converter.convert(LocalTime.class, values.get("Start Time")));
        }
    }

    @Test
    void pdfPreservesVietnameseText() throws Exception {
        String text = "Bu?i h?c ti?ng Vi?t";
        var config = new ExportSheetConfig<String>("Sessions", List.of(new ExportColumn<>("Title", value -> value)));
        var output = new ByteArrayOutputStream();
        new PdfExporter().export(List.of(text), config, output);
        try (var pdf = new PdfDocument(new PdfReader(new ByteArrayInputStream(output.toByteArray())))) {
            assertTrue(PdfTextExtractor.getTextFromPage(pdf.getPage(1)).contains(text));
        }
    }

    @Test
    void exportUsesPermissionCheckedFilteredServiceInsteadOfAllRepositoryRows() throws Exception {
        var service = mock(StudySessionService.class);
        var controller = new StudySessionController(service, mock(StudySessionRepository.class),
                mock(StudySessionImportService.class), mock(SubjectRepository.class), mock(StudySessionValidator.class), mock(StudySessionAssignmentResolver.class));
        var exporter = mock(ExportService.class);
        ReflectionTestUtils.setField(controller, "exportService", exporter);
        var filter = new StudySessionFilter();
        filter.setSubjectId(7L);
        var sort = Sort.by("title").descending();
        var rows = List.of(StudySessionDTO.builder().title("Filtered lesson").build());
        when(service.getAll(Pageable.unpaged(sort), "Java", filter)).thenReturn(new PageImpl<>(rows));
        var response = new MockHttpServletResponse();
        controller.exportFile(FileFormat.CSV, "Java", filter, PageRequest.of(0, 10, sort), response);
        verify(service).getAll(Pageable.unpaged(sort), "Java", filter);
        verify(exporter).export(FileFormat.CSV, rows, StudySessionDTO.class, response);
    }
}
