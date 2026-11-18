package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptDTO;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptReviewDTO;
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
import java.util.Map;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('EXAM_TAKE')")
public class ExamAttemptController {

    private final ExamAttemptService service;

    @GetMapping("/learner")
    public org.springframework.data.domain.Page<com.example.starter_project_2025.system.exam.dto.LearnerExamDTO> learnerExams(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return service.learnerExams(org.springframework.data.domain.PageRequest.of(Math.max(0, page), Math.min(100, Math.max(1, size)),
                org.springframework.data.domain.Sort.by("id").descending()));
    }

    @GetMapping("/{examId}/preparation")
    public com.example.starter_project_2025.system.exam.dto.ExamPreparationDTO preparation(
            @PathVariable Long examId, @AuthenticationPrincipal UserPrincipal principal) {
        return service.preparation(examId, principal.getUser().getId());
    }

    @GetMapping("/{examId}/attempt/current")
    public ExamAttemptDTO current(@PathVariable Long examId, @AuthenticationPrincipal UserPrincipal principal) {
        return service.currentAttempt(examId, principal.getUser().getId());
    }

    @PostMapping("/{examId}/attempt")
    public ResponseEntity<ExamAttemptDTO> startOrResume(
            @PathVariable Long examId,
            @RequestParam(value = "password", required = false) String password,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.startOrResume(examId, principal.getUser().getId(), password));
    }

    @GetMapping("/my-attempts")
    public ResponseEntity<List<ExamAttemptSummaryDTO>> getMyAttempts(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.findStudentAttempts(principal.getUser().getId()));
    }

    @GetMapping("/my-locks")
    public ResponseEntity<Map<Long, String>> getMyLocks(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.findLockedExamReasons(principal.getUser().getId()));
    }

    @GetMapping("/attempts/{attemptId}/review")
    public ResponseEntity<ExamAttemptReviewDTO> review(
            @PathVariable Long attemptId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.reviewAttempt(attemptId, principal.getUser().getId()));
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
