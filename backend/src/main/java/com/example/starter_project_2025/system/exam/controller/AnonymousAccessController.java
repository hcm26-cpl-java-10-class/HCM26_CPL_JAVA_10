package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.dto.AnonymousAccessResponse;
import com.example.starter_project_2025.system.exam.dto.AnonymousAttemptRequest;
import com.example.starter_project_2025.system.exam.dto.AnonymousInvitationRequest;
import com.example.starter_project_2025.system.exam.dto.AnonymousSessionRequest;
import com.example.starter_project_2025.system.exam.dto.AnonymousSessionResponse;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptDTO;
import com.example.starter_project_2025.system.exam.dto.InvitationDTO;
import com.example.starter_project_2025.system.exam.dto.SaveExamAnswerRequest;
import com.example.starter_project_2025.system.exam.service.AnonymousExamService;
import com.example.starter_project_2025.system.exam.service.InvitationService;
import io.swagger.v3.oas.annotations.tags.Tag;
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
@Tag(name = "Anonymous Exam Access", description = "APIs for exam access without a platform account")
public class AnonymousAccessController {

    private final InvitationService service;
    private final AnonymousExamService anonymousExamService;

    @PostMapping("/{examId}/invitations/anonymous")
    @PreAuthorize("hasAuthority('INVITATION_CREATE')")
    public ResponseEntity<InvitationDTO> createAnonymousInvitation(
            @PathVariable Long examId,
            @Valid @RequestBody AnonymousInvitationRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.createAnonymousInvitation(examId, request, principal));
    }

    @GetMapping("/verify-access/{code}")
    public ResponseEntity<AnonymousAccessResponse> verifyAccess(@PathVariable String code) {
        return ResponseEntity.ok(service.verifyAccessCode(code.toUpperCase()));
    }

    @PostMapping("/anonymous-session")
    public ResponseEntity<AnonymousSessionResponse> createSession(
            @Valid @RequestBody AnonymousSessionRequest request
    ) {
        return ResponseEntity.ok(service.createAnonymousSession(
                request.getAccessCode().toUpperCase(),
                request.getFingerprint(),
                request.getStudentName(),
                request.getStudentEmail()
        ));
    }

    @PostMapping("/anonymous/attempt")
    public ResponseEntity<ExamAttemptDTO> startOrResume(
            @Valid @RequestBody AnonymousAttemptRequest request
    ) {
        return ResponseEntity.ok(anonymousExamService.startOrResume(
                request.getSessionToken(),
                request.getPassword()
        ));
    }

    @PutMapping("/anonymous/attempts/{attemptId}/answers")
    public ResponseEntity<ExamAttemptDTO> saveAnswers(
            @PathVariable Long attemptId,
            @RequestHeader("X-Anonymous-Session") String sessionToken,
            @Valid @RequestBody List<@Valid SaveExamAnswerRequest> requests
    ) {
        return ResponseEntity.ok(anonymousExamService.saveAnswers(sessionToken, attemptId, requests));
    }

    @PostMapping("/anonymous/attempts/{attemptId}/submit")
    public ResponseEntity<ExamAttemptDTO> submit(
            @PathVariable Long attemptId,
            @RequestHeader("X-Anonymous-Session") String sessionToken,
            @Valid @RequestBody(required = false) List<@Valid SaveExamAnswerRequest> requests
    ) {
        return ResponseEntity.ok(anonymousExamService.submit(sessionToken, attemptId, requests));
    }
}