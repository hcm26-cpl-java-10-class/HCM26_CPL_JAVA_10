package com.example.starter_project_2025.system.question.controller;

import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.system.question.service.QuestionImportService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/questions/import")
@Tag(name = "Question Import", description = "API import câu hỏi từ CSV")
public class QuestionImportController {

    private final QuestionImportService importService;

    public QuestionImportController(QuestionImportService importService) {
        this.importService = importService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Import câu hỏi từ file CSV", description = "Upload file CSV để import danh sách câu hỏi, kiểm tra QuestionValidator và chống trùng lặp")
    public ResponseEntity<ImportResult> importQuestions(
            @RequestParam("file") MultipartFile file
    ) {
        ImportResult result = importService.importQuestionsFromCsv(file);
        return ResponseEntity.ok(result);
    }
}
