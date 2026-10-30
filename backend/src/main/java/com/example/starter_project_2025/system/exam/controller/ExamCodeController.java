package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.dto.CodeRunRequest;
import com.example.starter_project_2025.system.exam.dto.CodeRunResponse;
import com.example.starter_project_2025.system.exam.service.AnonymousExamService;
import com.example.starter_project_2025.system.exam.service.ExamCodeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
public class ExamCodeController {

    private final ExamCodeService service;
    private final AnonymousExamService anonymousExamService;

    /** Sinh vien co tai khoan chay thu code. */
    @PostMapping("/attempts/{attemptId}/code/run")
    @PreAuthorize("hasAuthority('EXAM_TAKE')")
    public ResponseEntity<CodeRunResponse> run(
            @PathVariable Long attemptId,
            @Valid @RequestBody CodeRunRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.run(attemptId, principal.getUser().getId(), request));
    }

    /** Thi an danh. */
    @PostMapping("/anonymous/attempts/{attemptId}/code/run")
    public ResponseEntity<CodeRunResponse> runAnonymous(
            @PathVariable Long attemptId,
            @RequestHeader("X-Anonymous-Session") String sessionToken,
            @Valid @RequestBody CodeRunRequest request
    ) {
        return ResponseEntity.ok(anonymousExamService.runCode(sessionToken, attemptId, request));
    }
}
