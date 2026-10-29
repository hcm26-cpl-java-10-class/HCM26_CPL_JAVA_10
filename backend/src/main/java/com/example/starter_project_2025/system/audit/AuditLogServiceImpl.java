
package com.example.starter_project_2025.system.audit;

import com.example.starter_project_2025.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuditLogServiceImpl implements AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final AuditDataSanitizer auditDataSanitizer;

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logLogout(
            Long actorId,
            String actorEmail,
            String correlationId,
            String result
    ) {
        AuditLog auditLog = AuditLog.builder()
                .actorId(actorId)
                .actorEmail(actorEmail)
                .action("LOGOUT")
                .entityType("AUTH")
                .entityId(actorId != null ? String.valueOf(actorId) : null)
                .oldValue(null)
                .newValue(null)
                .correlationId(correlationId)
                .build();

        auditLog.setResult(result);
        auditLogRepository.save(auditLog);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logLoginFailure(String email, String correlationId) {
        AuditLog auditLog = AuditLog.builder()
                .actorId(null)
                .actorEmail("SYSTEM")
                .action("LOGIN")
                .entityType("AUTH")
                .entityId(email)
                .oldValue(null)
                .newValue(null)
                .correlationId(correlationId)
                .build();

        auditLog.setResult("FAILURE");
        auditLogRepository.save(auditLog);
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(
            String action,
            String entityType,
            String entityId,
            String oldValue,
            String newValue,
            String correlationId,
            String result
    ) {
        Long actorId = null;
        String actorEmail = "SYSTEM";

        Authentication auth =
                SecurityContextHolder.getContext().getAuthentication();

        if (auth != null && auth.isAuthenticated()
                && !"anonymousUser".equals(auth.getPrincipal())) {

            Object principal = auth.getPrincipal();

            if (principal instanceof UserPrincipal userPrincipal) {
                actorId = userPrincipal.getUser().getId();
                actorEmail = userPrincipal.getUsername();
            } else {
                actorEmail = auth.getName();
            }
        }

        AuditLog auditLog = AuditLog.builder()
                .actorId(actorId)
                .actorEmail(actorEmail)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .oldValue(auditDataSanitizer.sanitize(oldValue))
                .newValue(auditDataSanitizer.sanitize(newValue))
                .correlationId(correlationId)
                .build();

        auditLog.setResult(result);
        auditLogRepository.save(auditLog);
    }
}
