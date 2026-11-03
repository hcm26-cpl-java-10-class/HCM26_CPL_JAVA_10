package com.example.starter_project_2025.exception;

/**
 * Thrown when a request is well-formed but cannot be applied to the current state of a resource
 * (illegal status transition, schedule overlap, ...). Mapped to HTTP 409.
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
