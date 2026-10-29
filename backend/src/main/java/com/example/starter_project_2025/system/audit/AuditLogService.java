package com.example.starter_project_2025.system.audit;

public interface AuditLogService {

    void log(
            String action,
            String entityType,
            String entityId,
            String oldValue,
            String newValue,
            String correlationId,
            String result
    );

    void logLogout(
            Long actorId,
            String actorEmail,
            String correlationId,
            String result
    );

    void logLoginFailure(String email, String correlationId);
}
