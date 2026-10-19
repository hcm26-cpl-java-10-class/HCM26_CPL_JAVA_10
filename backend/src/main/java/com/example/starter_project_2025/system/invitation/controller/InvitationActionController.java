package com.example.starter_project_2025.system.invitation.controller;

import com.example.starter_project_2025.system.invitation.dto.*;
import com.example.starter_project_2025.system.invitation.service.InvitationActionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/invitations")
@RequiredArgsConstructor
public class InvitationActionController {

    private final InvitationActionService actionService;

    @PostMapping({"/actions/invite", "/invite"})
    @PreAuthorize("hasAuthority('INVITATION_CREATE')")
    public ResponseEntity<InvitationDTO> inviteSingle(@Valid @RequestBody InvitationDTO request) {
        return ResponseEntity.ok(actionService.inviteSingle(request));
    }

    @PostMapping({"/actions/batch", "/batch"})
    @PreAuthorize("hasAuthority('INVITATION_CREATE')")
    public ResponseEntity<BatchInvitationResponse> inviteBatch(@Valid @RequestBody BatchInvitationRequest request) {
        return ResponseEntity.ok(actionService.inviteBatch(request));
    }

    @PostMapping({"/actions/{id}/resend", "/{id}/resend"})
    @PreAuthorize("hasAuthority('INVITATION_UPDATE')")
    public ResponseEntity<InvitationDTO> resend(@PathVariable Long id) {
        return ResponseEntity.ok(actionService.resend(id));
    }

    @PostMapping({"/actions/{id}/revoke", "/{id}/revoke"})
    @PreAuthorize("hasAuthority('INVITATION_UPDATE')")
    public ResponseEntity<InvitationDTO> revoke(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) RevokeInvitationRequest request) {
        return ResponseEntity.ok(actionService.revoke(id, request));
    }
}
