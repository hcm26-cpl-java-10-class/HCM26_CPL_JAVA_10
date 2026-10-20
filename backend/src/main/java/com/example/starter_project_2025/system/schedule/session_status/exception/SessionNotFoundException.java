package com.example.starter_project_2025.system.schedule.session_status.exception;

/**
 * Lỗi 404 SESSION_NOT_FOUND của module Session Operational Status (F15).
 */
public class SessionNotFoundException extends RuntimeException {

    public SessionNotFoundException(Long id) {
        super("Session not found with id: '" + id + "'");
    }
}
