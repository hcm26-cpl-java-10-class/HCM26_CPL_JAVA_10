package com.example.starter_project_2025.system.exam.audit;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.domain.Invitation;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class InvitationAuditService {

    private final InvitationAuditRepository invitationAuditRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Invitation invitation, InvitationAuditAction action,
                       UserPrincipal principal, String details) {
        InvitationAuditLog log = InvitationAuditLog.builder()
                .invitationId(invitation != null ? invitation.getId() : null)
                .examId(invitation != null && invitation.getExam() != null
                        ? invitation.getExam().getId() : null)
                .targetUserId(invitation != null && invitation.getUser() != null
                        ? invitation.getUser().getId() : null)
                .action(action)
                .performedBy(principal != null && principal.getUser() != null
                        ? principal.getUser().getId() : null)
                .details(details)
                .build();
        invitationAuditRepository.save(log);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(Long examId, Long invitationId, Long targetUserId,
                       InvitationAuditAction action, Long performedBy, String details) {
        InvitationAuditLog log = InvitationAuditLog.builder()
                .examId(examId)
                .invitationId(invitationId)
                .targetUserId(targetUserId)
                .action(action)
                .performedBy(performedBy)
                .details(details)
                .build();
        invitationAuditRepository.save(log);
    }

    @Transactional(readOnly = true)
    public List<InvitationAuditLog> listByExam(Long examId) {
        return invitationAuditRepository.findByExamIdOrderByCreatedAtDesc(examId);
    }

    @Transactional(readOnly = true)
    public List<InvitationAuditLog> listByInvitation(Long invitationId) {
        return invitationAuditRepository.findByInvitationIdOrderByCreatedAtDesc(invitationId);
    }
}
