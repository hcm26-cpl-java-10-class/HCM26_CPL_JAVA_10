
package com.example.starter_project_2025.system.audit;

import java.time.LocalDateTime;

public record AuditLogDTO(
        Long id,
        Long actorId,
        String actorEmail,
        String action,
        String entityType,
        String entityId,
        String oldValue,
        String newValue,
        String correlationId,
        LocalDateTime createdAt
) {
    public static AuditLogDTO fromEntity(AuditLog log) {
        return new AuditLogDTO(
                log.getId(),
                log.getActorId(),
                log.getActorEmail(),
                log.getAction(),
                log.getEntityType(),
                log.getEntityId(),
                log.getOldValue(),
                log.getNewValue(),
                log.getCorrelationId(),
                log.getCreatedAt()
        );
    }
}
