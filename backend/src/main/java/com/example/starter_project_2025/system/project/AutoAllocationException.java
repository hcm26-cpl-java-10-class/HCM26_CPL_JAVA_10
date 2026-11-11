package com.example.starter_project_2025.system.project;

import org.springframework.http.HttpStatus;

public class AutoAllocationException extends RuntimeException {
    private final HttpStatus status;
    private final String code;

    public AutoAllocationException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() { return status; }
    public String getCode() { return code; }
}
