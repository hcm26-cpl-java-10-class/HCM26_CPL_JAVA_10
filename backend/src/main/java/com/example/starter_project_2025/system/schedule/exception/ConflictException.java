package com.example.starter_project_2025.system.schedule.exception;

import lombok.Getter;

/**
 * Lỗi xung đột trạng thái/phiên bản (HTTP 409) — dùng cho F15 (schedule/session).
 *
 * <p>Ví dụ: SESSION_INVALID_TRANSITION, SESSION_VERSION_CONFLICT.</p>
 */
@Getter
public class ConflictException extends RuntimeException {

    private final String code;

    public ConflictException(String code, String message) {
        super(message);
        this.code = code;
    }
}
