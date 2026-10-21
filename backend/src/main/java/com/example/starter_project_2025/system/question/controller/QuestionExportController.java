package com.example.starter_project_2025.system.question.controller;

import com.example.starter_project_2025.system.question.dto.QuestionFilter;
import com.example.starter_project_2025.system.question.service.QuestionExportService;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;

@RestController
@RequestMapping("/api/questions")
@Tag(name = "Question Export", description = "APIs for user question export")
public class QuestionExportController {

    private final QuestionExportService exportService;

    public QuestionExportController(
            QuestionExportService exportService
    ) {
        this.exportService = exportService;
    }

    @GetMapping("/export")
    public ResponseEntity<byte[]> exportQuestions(
            @ModelAttribute QuestionFilter filter
    ) throws IOException {
        byte[] csv = exportService.exportCsv(filter);

        return csvResponse(csv, "questions.csv");
    }

    @GetMapping("/export/template")
    public ResponseEntity<byte[]> downloadTemplate(
            @RequestParam(value = "format", defaultValue = "xlsx") String format
    ) {
        if ("csv".equalsIgnoreCase(format)) {
            byte[] csv = exportService.downloadTemplate();
            return csvResponse(csv, "question-template.csv");
        }

        byte[] excel = exportService.downloadExcelTemplate();
        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"question-template.xlsx\""
                )
                .header("Access-Control-Expose-Headers", "Content-Disposition")
                .contentType(
                        MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                )
                .body(excel);
    }

    private ResponseEntity<byte[]> csvResponse(
            byte[] csv,
            String filename
    ) {
        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\""
                )
                .header("Access-Control-Expose-Headers", "Content-Disposition")
                .contentType(
                        MediaType.parseMediaType("text/csv; charset=UTF-8")
                )
                .body(csv);
    }
}
