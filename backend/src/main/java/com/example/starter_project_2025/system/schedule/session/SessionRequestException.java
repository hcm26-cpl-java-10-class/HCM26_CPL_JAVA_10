package com.example.starter_project_2025.system.schedule.session;

import lombok.Getter;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Map;

@Getter
public class SessionRequestException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final Map<String, List<String>> fieldErrors;

    public SessionRequestException(HttpStatus status, String code, String message) {
        this(status, code, message, Map.of());
    }

    public SessionRequestException(
            HttpStatus status, String code, String message, Map<String, List<String>> fieldErrors) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = Map.copyOf(fieldErrors);
    }

    public static SessionRequestException validation(String field, String message) {
        return new SessionRequestException(HttpStatus.UNPROCESSABLE_ENTITY, "SESSION_VALIDATION_FAILED",
                "Session data is invalid.", Map.of(field, List.of(message)));
    }
}
