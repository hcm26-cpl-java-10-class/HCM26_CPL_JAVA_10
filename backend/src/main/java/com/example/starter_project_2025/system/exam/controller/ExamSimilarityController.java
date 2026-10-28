package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.system.exam.dto.ExamSimilarityDTO;
import com.example.starter_project_2025.system.exam.service.ExamSimilarityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/exams/{examId}/similarity")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('EXAM_UPDATE')")
public class ExamSimilarityController {

    private final ExamSimilarityService similarityService;

    @GetMapping
    public ResponseEntity<ExamSimilarityDTO.SimilarityReport> getSimilarityReport(@PathVariable Long examId) {
        return ResponseEntity.ok(similarityService.scanExamSimilarity(examId));
    }

    @PostMapping("/scan")
    public ResponseEntity<ExamSimilarityDTO.SimilarityReport> triggerSimilarityScan(@PathVariable Long examId) {
        return ResponseEntity.ok(similarityService.scanExamSimilarity(examId));
    }
}
