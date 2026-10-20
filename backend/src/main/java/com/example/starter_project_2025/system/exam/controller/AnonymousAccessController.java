package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.dto.AnonymousAccessResponse;
import com.example.starter_project_2025.system.exam.dto.AnonymousInvitationRequest;
import com.example.starter_project_2025.system.exam.dto.AnonymousSessionRequest;
import com.example.starter_project_2025.system.exam.dto.AnonymousSessionResponse;
import com.example.starter_project_2025.system.exam.dto.InvitationDTO;
import com.example.starter_project_2025.system.exam.service.InvitationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
@Tag(name = "Anonymous Exam Access", description = "APIs for exam access without a platform account")
public class AnonymousAccessController {

    private final InvitationService service;

    /**
     * Trainer/Admin creates an access invite for a student that has no RBAC account.
     */
    @PostMapping("/{examId}/invitations/anonymous")
    @PreAuthorize("hasAuthority('INVITATION_CREATE')")
    public ResponseEntity<InvitationDTO> createAnonymousInvitation(
            @PathVariable Long examId,
            @Valid @RequestBody AnonymousInvitationRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.createAnonymousInvitation(examId, request, principal));
    }

    /**
     * Public: verify an access code before entering the exam.
     */
    @GetMapping("/verify-access/{code}")
    public ResponseEntity<AnonymousAccessResponse> verifyAccess(@PathVariable String code) {
        return ResponseEntity.ok(service.verifyAccessCode(code.toUpperCase()));
    }

    /**
     * Public: exchange an access code for an anonymous session token.
     */
    @PostMapping("/anonymous-session")
    public ResponseEntity<AnonymousSessionResponse> createSession(
            @Valid @RequestBody AnonymousSessionRequest request
    ) {
        return ResponseEntity.ok(service.createAnonymousSession(
                request.getAccessCode().toUpperCase(),
                request.getFingerprint()
        ));
    }
}