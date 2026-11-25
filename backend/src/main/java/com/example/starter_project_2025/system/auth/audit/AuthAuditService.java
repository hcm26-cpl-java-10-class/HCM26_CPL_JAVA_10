package com.example.starter_project_2025.system.auth.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthAuditService {

    private final AuthAuditRepository repository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(
            Long tenantId,
            Long actorId,
            String actorEmail,
            Long targetUserId,
            AuthAuditAction action,
            String ipAddress,
            String userAgent,
            String detail
    ) {
        try {
            AuthAuditLog entry = AuthAuditLog.builder()
                    .tenantId(tenantId)
                    .actorId(actorId)
                    .actorEmail(truncate(actorEmail, 255))
                    .targetUserId(targetUserId)
                    .action(action)
                    .ipAddress(truncate(ipAddress, 64))
                    .userAgent(truncate(userAgent, 512))
                    .correlationId(truncate(MDC.get("correlationId"), 64))
                    .detail(truncate(detail, 500))
                    .build();
            repository.save(entry);
        } catch (Exception ex) {
            log.warn("Failed to persist auth audit log for action {}: {}", action, ex.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public Page<AuthAuditLog> search(AuthAuditAction action, String email, Pageable pageable) {
        String normalizedEmail = (email == null || email.isBlank()) ? null : email.trim();
        return repository.search(action, normalizedEmail, pageable);
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return null;
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
