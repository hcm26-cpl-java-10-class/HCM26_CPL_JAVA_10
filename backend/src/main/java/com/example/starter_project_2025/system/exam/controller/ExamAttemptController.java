package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptDTO;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptSummaryDTO;
import com.example.starter_project_2025.system.exam.dto.SaveExamAnswerRequest;
import com.example.starter_project_2025.system.exam.service.ExamAttemptService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('EXAM_TAKE')")
public class ExamAttemptController {

    private final ExamAttemptService service;

    @PostMapping("/{examId}/attempt")
    public ResponseEntity<ExamAttemptDTO> startOrResume(
            @PathVariable Long examId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.startOrResume(examId, principal.getUser().getId()));
    }

    @GetMapping("/my-attempts")
    public ResponseEntity<List<ExamAttemptSummaryDTO>> getMyAttempts(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.findStudentAttempts(principal.getUser().getId()));
    }

    @PutMapping("/attempts/{attemptId}/answers")
    public ResponseEntity<ExamAttemptDTO> saveAnswers(
            @PathVariable Long attemptId,
            @Valid @RequestBody List<@Valid SaveExamAnswerRequest> requests,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.saveAnswers(
                attemptId,
                principal.getUser().getId(),
                requests
        ));
    }

    @PostMapping("/attempts/{attemptId}/submit")
    public ResponseEntity<ExamAttemptDTO> submit(
            @PathVariable Long attemptId,
            @Valid @RequestBody(required = false) List<@Valid SaveExamAnswerRequest> requests,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.submit(
                attemptId,
                principal.getUser().getId(),
                requests
        ));
    }
}
