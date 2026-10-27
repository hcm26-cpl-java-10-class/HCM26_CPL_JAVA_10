package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.system.exam.dto.EssayGradingDTO;
import com.example.starter_project_2025.system.exam.service.ExamEssayGradingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/exams/{examId}/grading")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('EXAM_UPDATE')")
public class ExamGradingController {

    private final ExamEssayGradingService service;

    @GetMapping("/attempts")
    public ResponseEntity<List<EssayGradingDTO.Summary>> listPending(@PathVariable Long examId) {
        return ResponseEntity.ok(service.listPending(examId));
    }

    @GetMapping("/attempts/{attemptId}")
    public ResponseEntity<EssayGradingDTO.Detail> getDetail(
            @PathVariable Long examId,
            @PathVariable Long attemptId
    ) {
        return ResponseEntity.ok(service.getDetail(examId, attemptId));
    }

    @PostMapping("/attempts/{attemptId}/grade")
    public ResponseEntity<EssayGradingDTO.Detail> submitOfficialGrade(
            @PathVariable Long examId,
            @PathVariable Long attemptId,
            @RequestBody EssayGradingDTO.GradeSubmissionRequest request
    ) {
        return ResponseEntity.ok(service.submitOfficialGrade(examId, attemptId, request));
    }

    @PostMapping("/attempts/{attemptId}/ai-suggest")
    public ResponseEntity<EssayGradingDTO.AiGradingResponse> requestAiGrading(
            @PathVariable Long examId,
            @PathVariable Long attemptId,
            @RequestBody(required = false) EssayGradingDTO.AiGradingRequest request
    ) {
        return ResponseEntity.ok(service.requestAiGrading(examId, attemptId, request));
    }
}
