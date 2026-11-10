package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.system.exam.service.ExamResultExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@RestController
@RequestMapping("/api/exams/{examId}/result-statistics")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('EXAM_UPDATE')")
public class ExamResultStatisticsExportController {

    private final ExamResultExportService exportService;

    @GetMapping("/export")
    public ResponseEntity<byte[]> export(
            @PathVariable Long examId,
            @RequestParam(defaultValue = "xlsx") String format
    ) throws IOException {

        String normalizedFormat = format.trim()
                .toLowerCase(Locale.ROOT);

        byte[] file;
        MediaType mediaType;
        String extension;

        switch (normalizedFormat) {
            case "xlsx" -> {
                file = exportService.exportExcel(examId);
                mediaType = MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                );
                extension = "xlsx";
            }
            case "csv" -> {
                file = exportService.exportCsv(examId);
                mediaType = new MediaType(
                        "text", "csv", StandardCharsets.UTF_8
                );
                extension = "csv";
            }
            case "pdf" -> {
                file = exportService.exportPdf(examId);
                mediaType = MediaType.APPLICATION_PDF;
                extension = "pdf";
            }
            default -> throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Unsupported export format. Use xlsx, csv, or pdf."
            );
        }

        String filename =
                "exam-" + examId + "-result-statistics." + extension;

        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\""
                )
                .body(file);
    }
}
