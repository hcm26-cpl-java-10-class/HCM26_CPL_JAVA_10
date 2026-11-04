package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.InvitationStatus;
import com.example.starter_project_2025.system.exam.dto.*;
import com.example.starter_project_2025.system.exam.service.InvitationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Tag(name = "Invitation", description = "APIs for managing exam invitations")
public class InvitationController {

    private final InvitationService service;

    @PostMapping("/exams/{examId}/invitations")
    @PreAuthorize("hasAuthority('INVITATION_CREATE')")
    public ResponseEntity<InvitationDTO> create(
            @PathVariable Long examId,
            @Valid @RequestBody InvitationCreateRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.createInvitation(examId, request, principal));
    }

    @PostMapping("/exams/{examId}/invitations/batch")
    @PreAuthorize("hasAuthority('INVITATION_CREATE')")
    public ResponseEntity<BatchInvitationResponse> createBatch(
            @PathVariable Long examId,
            @Valid @RequestBody BatchInvitationRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.createBatchInvitations(examId, request, principal));
    }

    @GetMapping("/exams/{examId}/invitations")
    @PreAuthorize("hasAuthority('INVITATION_READ')")
    public ResponseEntity<List<InvitationDTO>> listByExam(
            @PathVariable Long examId,
            @RequestParam(required = false) InvitationStatus status,
            @RequestParam(required = false) Boolean anonymous
    ) {
        InvitationFilter filter = InvitationFilter.builder()
                .status(status)
                .anonymous(anonymous)
                .build();

        return ResponseEntity.ok(service.getInvitationsByExam(examId, filter));
    }

    @GetMapping("/invitations/{id}")
    @PreAuthorize("hasAuthority('INVITATION_READ')")
    public ResponseEntity<InvitationDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(service.getById(id));
    }

    @PatchMapping("/invitations/{id}/revoke")
    @PreAuthorize("hasAuthority('INVITATION_DELETE')")
    public ResponseEntity<InvitationDTO> revoke(
            @PathVariable Long id,
            @RequestParam(required = false) String reason
    ) {
        return ResponseEntity.ok(service.revokeInvitation(id, reason));
    }

    @PostMapping("/invitations/{id}/resend")
    @PreAuthorize("hasAuthority('INVITATION_UPDATE')")
    public ResponseEntity<InvitationDTO> resend(@PathVariable Long id) {
        return ResponseEntity.ok(service.resendInvitation(id));
    }

    @GetMapping(value = "/invitations/{id}/qr", produces = MediaType.IMAGE_PNG_VALUE)
    @PreAuthorize("hasAuthority('INVITATION_READ')")
    public ResponseEntity<byte[]> generateQR(@PathVariable Long id) {
        byte[] png = service.generateQRCode(id);

        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"invitation-" + id + ".png\"")
                .body(png);
    }

    @GetMapping("/invitations/my")
    @PreAuthorize("hasAuthority('INVITATION_READ') or hasAuthority('EXAM_TAKE')")
    public ResponseEntity<List<InvitationDTO>> myInvitations(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.getMyInvitations(principal));
    }

    @PatchMapping("/invitations/{id}/accept")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<InvitationDTO> accept(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.acceptInvitation(id, principal));
    }

    @PatchMapping("/invitations/{id}/reject")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<InvitationDTO> reject(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(service.rejectInvitation(id, principal));
    }
}