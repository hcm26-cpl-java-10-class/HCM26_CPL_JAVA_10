package com.example.starter_project_2025.system.project;

public class IdempotencyRequestInProgressException extends RuntimeException {

    public IdempotencyRequestInProgressException() {
        super("A request with this idempotency key is still being processed");
    }
}
