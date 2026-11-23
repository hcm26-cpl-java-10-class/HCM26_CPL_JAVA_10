package com.example.starter_project_2025.system.project.developmentinsights.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.example.starter_project_2025.system.project.developmentinsights.dto.GitActivityDtos;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.canvas.parser.PdfTextExtractor;
import java.io.ByteArrayInputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;

class GitDevelopmentReportExportServiceTest {
    private GitActivityService activity;
    private GitDevelopmentReportExportService exports;
    private GitActivityDtos.ProjectDevelopmentReport projectReport;
    private GitActivityDtos.SprintDevelopmentReport sprintReport;

    @BeforeEach
    void setUp() {
        activity = mock(GitActivityService.class);
        exports = new GitDevelopmentReportExportService(activity);
        var summary = new GitActivityDtos.GitActivitySummary(3, 2, 1, 1, 0);
        var traceability = new GitActivityDtos.TaskTraceability(1, 1, 1, 2, 1);
        var developer = new GitActivityDtos.DeveloperActivityRow(101L, 201L, "Nguy\u1EC5n An", "nguyen-an",
                false, false, 3, 2, 1, 2, Instant.parse("2026-11-20T12:00:00Z"));
        projectReport = new GitActivityDtos.ProjectDevelopmentReport(10L, 10L, "D\u1EF1 \u00E1n m\u1EABu", "owner/repo",
                "https://github.com/owner/repo", true, true, 5, 1, 1, 1, 2,
                summary, traceability, List.of(developer));
        sprintReport = new GitActivityDtos.SprintDevelopmentReport(
                new GitActivityDtos.SprintOverview(77L, "Sprint demo", LocalDateTime.parse("2026-11-17T00:00:00"),
                        LocalDateTime.parse("2026-11-23T23:59:59"), 5, 1, 1, 1, 2, 3),
                summary, traceability, List.of(developer), true, true);
    }

    @Test
    void projectPdfAndExcelUseTheSelectedReportScopeAndFilters() throws Exception {
        LocalDate from = LocalDate.parse("2026-11-19");
        LocalDate to = LocalDate.parse("2026-11-20");
        when(activity.projectDevelopmentReport(3L, 10L, 77L, from, to, 101L)).thenReturn(projectReport);

        var pdf = exports.project(3L, 10L, 77L, 101L, from, to,
                GitDevelopmentReportExportService.Format.PDF);
        var excel = exports.project(3L, 10L, 77L, 101L, from, to,
                GitDevelopmentReportExportService.Format.EXCEL);

        assertThat(pdf.fileName()).isEqualTo("d-n-m-u-sprint-77.pdf");
        assertThat(pdf.contentType()).isEqualTo("application/pdf");
        assertThat(pdf.generatedAt()).isNotNull();
        assertThat(pdf.from()).isEqualTo(from);
        assertThat(pdf.to()).isEqualTo(to);
        try (PdfDocument document = new PdfDocument(new PdfReader(new ByteArrayInputStream(pdf.bytes())))) {
            String text = PdfTextExtractor.getTextFromPage(document.getFirstPage());
            assertThat(text).contains("D\u1EF1 \u00E1n m\u1EABu", "2026-11-19", "2026-11-20", "Nguy\u1EC5n An");
        }

        assertThat(excel.fileName()).isEqualTo("d-n-m-u-sprint-77.xlsx");
        assertThat(excel.sprintId()).isEqualTo(77L);
        assertThat(excel.developerId()).isEqualTo(101L);
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(excel.bytes()))) {
            assertThat(workbook.getSheet("Development Report").getRow(0).getCell(0).getStringCellValue())
                    .contains("D\u1EF1 \u00E1n m\u1EABu");
            assertThat(workbook.getSheet("Developer Activity").getRow(1).getCell(0).getStringCellValue())
                    .isEqualTo("Nguy\u1EC5n An");
            assertThat(allText(workbook)).contains("2026-11-19", "2026-11-20", "Sprint filter");
        }
        verify(activity, org.mockito.Mockito.times(2))
                .projectDevelopmentReport(3L, 10L, 77L, from, to, 101L);
    }

    @Test
    void sprintExportUsesOnlyTheRequestedSprintReport() throws Exception {
        when(activity.sprintDevelopmentReport(3L, 77L)).thenReturn(sprintReport);

        var file = exports.sprint(3L, 77L, GitDevelopmentReportExportService.Format.EXCEL);

        assertThat(file.sprintId()).isEqualTo(77L);
        assertThat(file.fileName()).isEqualTo("sprint-77.xlsx");
        assertThat(file.generatedAt()).isNotNull();
        try (XSSFWorkbook workbook = new XSSFWorkbook(new ByteArrayInputStream(file.bytes()))) {
            assertThat(workbook.getSheet("Development Report").getRow(4).getCell(1).getStringCellValue())
                    .isEqualTo("Sprint demo");
            assertThat(allText(workbook)).contains("2026-11-17T00:00", "2026-11-23T23:59:59");
        }
        verify(activity).sprintDevelopmentReport(3L, 77L);
    }

    @Test
    void deniedReportReadDoesNotCreateAnExportFile() {
        when(activity.projectDevelopmentReport(3L, 10L, null, null, null, null))
                .thenThrow(new AccessDeniedException("Workspace report access denied"));

        assertThatThrownBy(() -> exports.project(3L, 10L, null, null, null, null,
                GitDevelopmentReportExportService.Format.PDF))
                .isInstanceOf(AccessDeniedException.class);
    }

    private static String allText(XSSFWorkbook workbook) {
        StringBuilder result = new StringBuilder();
        workbook.forEach(sheet -> sheet.forEach(row -> row.forEach(cell -> result.append(cell.toString()).append('\n'))));
        return result.toString();
    }
}
