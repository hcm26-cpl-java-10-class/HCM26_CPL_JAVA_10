package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.system.exam.dto.AiQuestionGeneratorDTO.*;
import com.example.starter_project_2025.system.exam.service.ai.AiQuestionGeneratorService;
import com.example.starter_project_2025.system.exam.service.ai.DocumentTextExtractorService;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/exams/ai-generator")
@RequiredArgsConstructor
@PreAuthorize("hasAnyAuthority('EXAM_CREATE', 'EXAM_UPDATE', 'QUESTION_CREATE') or hasAnyRole('TEACHER', 'ADMIN')")
public class AiQuestionGeneratorController {

    private final AiQuestionGeneratorService generatorService;
    private final DocumentTextExtractorService documentExtractorService;

    @GetMapping("/status")
    public ResponseEntity<GeneratorStatusResponse> getStatus() {
        return ResponseEntity.ok(generatorService.getStatus());
    }

    @PostMapping(value = "/extract-document", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<DocumentExtractResponse> extractDocument(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(documentExtractorService.extractText(file));
    }

    @PostMapping("/generate")
    public ResponseEntity<GenerateResponse> generateQuestions(@Valid @RequestBody GenerateRequest req) {
        return ResponseEntity.ok(generatorService.generateQuestions(req));
    }

    @PostMapping("/regenerate-single")
    public ResponseEntity<GeneratedQuestion> regenerateSingle(@Valid @RequestBody RegenerateSingleRequest req) {
        return ResponseEntity.ok(generatorService.regenerateSingle(req));
    }

    @PostMapping("/commit-to-exam")
    public ResponseEntity<CommitToExamResponse> commitToExam(@Valid @RequestBody CommitToExamRequest req) {
        return ResponseEntity.ok(generatorService.commitToExam(req));
    }

    @GetMapping("/exams/{examId}/questions")
    public ResponseEntity<List<QuestionDTO>> getExamAiQuestions(@PathVariable Long examId) {
        return ResponseEntity.ok(generatorService.getExamAiQuestions(examId));
    }

    @DeleteMapping("/exams/{examId}/questions/{questionId}")
    public ResponseEntity<Void> deleteAiQuestionPermanently(
            @PathVariable Long examId,
            @PathVariable Long questionId
    ) {
        generatorService.deleteAiQuestionPermanently(examId, questionId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/exams/{examId}/cleanup")
    public ResponseEntity<Map<String, Object>> cleanupUnusedAiQuestions(@PathVariable Long examId) {
        int count = generatorService.cleanupUnusedAiQuestions(examId);
        return ResponseEntity.ok(Map.of("deletedCount", count, "message", "Đã dọn dẹp " + count + " câu hỏi AI chưa sử dụng."));
    }
}
