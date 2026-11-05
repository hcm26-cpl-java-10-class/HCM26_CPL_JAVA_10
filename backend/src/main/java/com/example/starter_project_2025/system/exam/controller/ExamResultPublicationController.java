package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.system.exam.domain.ScoreReleasePolicy;
import com.example.starter_project_2025.system.exam.dto.ExamResultPublicationDTO;
import com.example.starter_project_2025.system.exam.service.ExamResultPublicationService;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/exams/{examId}/result-publication")
@RequiredArgsConstructor
public class ExamResultPublicationController {

    private final ExamResultPublicationService service;

    @GetMapping
    @PreAuthorize("hasAuthority('EXAM_UPDATE')")
    public ResponseEntity<ExamResultPublicationDTO> getStatus(
            @PathVariable Long examId
    ) {
        return ResponseEntity.ok(service.getStatus(examId));
    }

    @PostMapping("/publish")
    @PreAuthorize("hasAuthority('EXAM_UPDATE')")
    public ResponseEntity<ExamResultPublicationDTO> publish(
            @PathVariable Long examId,
            @RequestBody PublishRequest request
    ) {
        return ResponseEntity.ok(
                service.publish(examId, request.getReleasePolicy())
        );
    }

    @PostMapping("/unpublish")
    @PreAuthorize("hasAuthority('EXAM_UPDATE')")
    public ResponseEntity<ExamResultPublicationDTO> unpublish(
            @PathVariable Long examId
    ) {
        return ResponseEntity.ok(service.unpublish(examId));
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class PublishRequest {
        private ScoreReleasePolicy releasePolicy;
    }
}