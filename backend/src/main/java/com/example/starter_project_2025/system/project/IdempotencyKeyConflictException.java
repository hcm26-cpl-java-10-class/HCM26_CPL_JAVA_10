package com.example.starter_project_2025.system.project;

public class IdempotencyKeyConflictException extends RuntimeException {

    public IdempotencyKeyConflictException() {
        super("Idempotency key was already used with a different request");
    }
}
