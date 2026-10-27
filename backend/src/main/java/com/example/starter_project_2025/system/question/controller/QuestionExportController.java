package com.example.starter_project_2025.system.question.controller;

import com.example.starter_project_2025.system.question.dto.QuestionFilter;
import com.example.starter_project_2025.system.question.service.QuestionExportService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.io.IOException;

@RestController
@RequestMapping("/api/questions/export")
@Tag(
        name = "Question Export",
        description = "Export questions and download import templates"
)
public class QuestionExportController {

    private final QuestionExportService exportService;

    public QuestionExportController(
            QuestionExportService exportService
    ) {
        this.exportService = exportService;
    }

    @GetMapping({"", "/"})
    public ResponseEntity<byte[]> exportQuestions(
            @ModelAttribute QuestionFilter filter
    ) throws IOException {
        return attachment(
                exportService.exportLegacyCsv(filter),
                "questions.csv",
                "text/csv; charset=UTF-8"
        );
    }

    @GetMapping("/template")
    public ResponseEntity<byte[]> downloadTemplate(
            @RequestParam(value = "format", defaultValue = "xlsx")
            String format
    ) {
        if ("csv".equalsIgnoreCase(format)) {
            return attachment(
                    exportService.downloadTemplate(),
                    "question-template.csv",
                    "text/csv; charset=UTF-8"
            );
        }

        if (!"xlsx".equalsIgnoreCase(format)
                && !"excel".equalsIgnoreCase(format)) {
            return ResponseEntity.badRequest().build();
        }

        return attachment(
                exportService.downloadExcelTemplate(),
                "question-template.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
    }

    @GetMapping("/csv")
    public ResponseEntity<byte[]> exportCsv(
            @ModelAttribute QuestionFilter filter
    ) throws IOException {
        return attachment(
                exportService.exportCsv(filter),
                "questions.csv",
                "text/csv; charset=UTF-8"
        );
    }

    @GetMapping("/xlsx")
    public ResponseEntity<byte[]> exportExcel(
            @ModelAttribute QuestionFilter filter
    ) throws IOException {
        return attachment(
                exportService.exportExcel(filter),
                "questions.xlsx",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
    }

    @GetMapping("/pdf")
    public ResponseEntity<byte[]> exportPdf(
            @ModelAttribute QuestionFilter filter
    ) throws IOException {
        return attachment(
                exportService.exportPdf(filter),
                "questions.pdf",
                "application/pdf"
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
