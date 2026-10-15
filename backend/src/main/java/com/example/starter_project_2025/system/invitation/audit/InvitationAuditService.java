package com.example.starter_project_2025.system.invitation.audit;

import com.example.starter_project_2025.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class InvitationAuditService {

    private final InvitationAuditRepository auditRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(Long invitationId, Long examId, Long userId, String action, String details) {
        String performedBy = resolveCurrentAuditor();

        InvitationAuditLog auditLog = InvitationAuditLog.builder()
                .invitationId(invitationId)
                .examId(examId)
                .userId(userId)
                .action(action)
                .performedBy(performedBy)
                .details(details)
                .build();

        auditRepository.save(auditLog);

        log.info("[AUDIT] Action: {}, invitationId: {}, examId: {}, userId: {}, performedBy: {}, details: {}",
                action, invitationId, examId, userId, performedBy, details);
    }

    public List<InvitationAuditLog> getAuditLogsForInvitation(Long invitationId) {
        return auditRepository.findByInvitationIdOrderByCreatedAtDesc(invitationId);
    }

    public List<InvitationAuditLog> getAuditLogsForExam(Long examId) {
        return auditRepository.findByExamIdOrderByCreatedAtDesc(examId);
    }

    private String resolveCurrentAuditor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            return "SYSTEM";
        }

        Object principal = auth.getPrincipal();
        if (principal instanceof UserPrincipal up) {
            return up.getUsername();
        }
        return auth.getName();
    }
}
