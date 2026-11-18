package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.system.exam.service.ExamImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/exams/import")
@RequiredArgsConstructor
@Tag(name = "Exam Import", description = "Import assessments/exams from Excel or CSV files")
public class ExamImportController {

    private final ExamImportService importService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAuthority('EXAM_CREATE')")
    @Operation(summary = "Import assessments/exams from Excel (.xlsx/.xls) or CSV file")
    public ResponseEntity<ImportResult> importExams(
            @RequestParam("file") MultipartFile file
    ) {
        ImportResult result = importService.importExams(file);
        return ResponseEntity.ok(result);
    }
}
