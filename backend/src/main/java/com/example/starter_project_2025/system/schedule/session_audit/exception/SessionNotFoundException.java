package com.example.starter_project_2025.system.schedule.session_audit.exception;

/**
 * T2 — 404 SESSION_NOT_FOUND (không tồn tại / ngoài phạm vi tenant).
 */
public class SessionNotFoundException extends RuntimeException {

    public SessionNotFoundException(Long sessionId) {
        super("Session not found with id: '" + sessionId + "'");
    }
}
