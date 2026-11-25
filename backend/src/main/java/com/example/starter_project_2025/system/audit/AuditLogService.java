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

    /**
     * Records a successful business event; the actor is the current user.
     * oldValue/newValue must be JSON (see AuditSupport.json) or null.
     */
    void logEvent(
            String action,
            String entityType,
            String entityId,
            String oldValue,
            String newValue
    );

    /**
     * Same as logEvent but with an explicit actor, for events that happen
     * before the user is authenticated (register, reset password...).
     */
    void logEventAs(
            Long actorId,
            String actorEmail,
            String action,
            String entityType,
            String entityId,
            String oldValue,
            String newValue
    );

    /**
     * Full-control variant used by the audit rules: explicit actor, correlation id and result.
     */
    void logAs(
            Long actorId,
            String actorEmail,
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
