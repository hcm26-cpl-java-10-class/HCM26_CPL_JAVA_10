package com.example.starter_project_2025.system.notification.audit;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationAuditService {

    private final NotificationAuditRepository repository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(
            Long tenantId,
            Long actorId,
            String actorEmail,
            String action,
            String entityType,
            String entityId,
            String beforeState,
            String afterState
    ) {
        try {
            NotificationAuditLog entry = NotificationAuditLog.builder()
                    .tenantId(tenantId)
                    .actorId(actorId)
                    .actorEmail(truncate(actorEmail, 255))
                    .action(truncate(action, 60))
                    .entityType(truncate(entityType, 60))
                    .entityId(truncate(entityId, 100))
                    .beforeState(truncate(beforeState, 1000))
                    .afterState(truncate(afterState, 1000))
                    .correlationId(truncate(MDC.get("correlationId"), 64))
                    .build();
            repository.save(entry);
        } catch (Exception ex) {
            log.warn("Failed to persist notification audit log for action {}: {}", action, ex.getMessage());
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
