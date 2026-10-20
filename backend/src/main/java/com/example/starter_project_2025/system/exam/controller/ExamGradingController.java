package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.system.exam.dto.EssayGradingDTO;
import com.example.starter_project_2025.system.exam.service.ExamEssayGradingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
}
