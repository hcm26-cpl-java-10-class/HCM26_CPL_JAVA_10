package com.example.starter_project_2025.system.schedule.session_audit.exception;

import lombok.Getter;

/**
 * T2 — 409 cho module notes/audit
 * (SESSION_VERSION_CONFLICT / SESSION_INVALID_TRANSITION / IDEMPOTENCY_KEY_REUSED).
 */
@Getter
public class SessionAuditConflictException extends RuntimeException {

    private final String code;

    public SessionAuditConflictException(String code, String message) {
        super(message);
        this.code = code;
    }
}
