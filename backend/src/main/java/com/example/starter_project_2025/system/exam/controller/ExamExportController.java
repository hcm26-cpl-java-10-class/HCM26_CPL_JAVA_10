package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.system.exam.dto.ExamFilter;
import com.example.starter_project_2025.system.exam.service.ExamExportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;

@RestController
@RequestMapping("/api/exams/export")
@RequiredArgsConstructor
@Tag(name = "Exam Export", description = "Export assessments/exams to Excel, CSV, PDF and download import templates")
public class ExamExportController {

    private final ExamExportService exportService;

    @GetMapping("/xlsx")
    @PreAuthorize("hasAuthority('EXAM_READ')")
    @Operation(summary = "Export assessments to Excel (.xlsx)")
    public ResponseEntity<byte[]> exportExcel(
            @ModelAttribute ExamFilter filter,
            @RequestParam(required = false) String search
    ) throws IOException {
        return attachment(
                exportService.exportExcel(filter, search),
                "assessments.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
    }

    @GetMapping("/csv")
    @PreAuthorize("hasAuthority('EXAM_READ')")
    @Operation(summary = "Export assessments to CSV (.csv)")
    public ResponseEntity<byte[]> exportCsv(
            @ModelAttribute ExamFilter filter,
            @RequestParam(required = false) String search
    ) {
        return attachment(
                exportService.exportCsv(filter, search),
                "assessments.csv",
                "text/csv; charset=UTF-8"
        );
    }

    @GetMapping("/pdf")
    @PreAuthorize("hasAuthority('EXAM_READ')")
    @Operation(summary = "Export assessments to PDF (.pdf)")
    public ResponseEntity<byte[]> exportPdf(
            @ModelAttribute ExamFilter filter,
            @RequestParam(required = false) String search
    ) throws IOException {
        return attachment(
                exportService.exportPdf(filter, search),
                "assessments.pdf",
                "application/pdf"
        );
    }

    @GetMapping("/template")
    @PreAuthorize("hasAuthority('EXAM_READ')")
    @Operation(summary = "Download sample template for importing assessments")
    public ResponseEntity<byte[]> downloadTemplate(
            @RequestParam(defaultValue = "xlsx") String format
    ) {
        if ("csv".equalsIgnoreCase(format)) {
            return attachment(
                    exportService.downloadCsvTemplate(),
                    "assessments-template.csv",
                    "text/csv; charset=UTF-8"
            );
        }

        return attachment(
                exportService.downloadExcelTemplate(),
                "assessments-template.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
    }

    private ResponseEntity<byte[]> attachment(
            byte[] data,
            String filename,
            String contentType
    ) {
        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\""
                )
                .header(
                        HttpHeaders.ACCESS_CONTROL_EXPOSE_HEADERS,
                        HttpHeaders.CONTENT_DISPOSITION
                )
                .contentType(MediaType.parseMediaType(contentType))
                .contentLength(data.length)
                .body(data);
    }
}
