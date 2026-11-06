package com.example.starter_project_2025.system.external_api.exception;

import lombok.Getter;

@Getter
public class ExternalApiException extends RuntimeException {

    private final int statusCode;
    private final String responseBody;

    public ExternalApiException(String message) {
        super(message);
        this.statusCode = 0;
        this.responseBody = null;
    }

    public ExternalApiException(String message, int statusCode, String responseBody) {
        super(message);
        this.statusCode = statusCode;
        this.responseBody = responseBody;
    }

    public ExternalApiException(String message, Throwable cause) {
        super(message, cause);
        this.statusCode = 0;
        this.responseBody = null;
    }
}
