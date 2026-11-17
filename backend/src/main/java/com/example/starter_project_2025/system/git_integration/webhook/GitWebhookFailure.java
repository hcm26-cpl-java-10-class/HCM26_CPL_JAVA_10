package com.example.starter_project_2025.system.git_integration.webhook;

import lombok.Getter;

/**
 * SY-04: a handler failure classified for the retry policy. Retryable failures
 * (network, GitHub 5xx, rate limit) become FAILED_RETRYABLE with backoff;
 * permanent ones (missing permission, installation gone) become FAILED at once.
 * The message must be safe to store: no tokens, no response bodies.
 */
@Getter
public class GitWebhookFailure extends RuntimeException {

    private final boolean retryable;
    /** Minimum wait asked by GitHub (rate limit), or null. */
    private final Long retryAfterSeconds;

    private GitWebhookFailure(String message, boolean retryable, Long retryAfterSeconds, Throwable cause) {
        super(message, cause);
        this.retryable = retryable;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public static GitWebhookFailure retryable(String message, Long retryAfterSeconds) {
        return new GitWebhookFailure(message, true, retryAfterSeconds, null);
    }

    public static GitWebhookFailure retryable(String message, Long retryAfterSeconds, Throwable cause) {
        return new GitWebhookFailure(message, true, retryAfterSeconds, cause);
    }

    public static GitWebhookFailure permanent(String message) {
        return new GitWebhookFailure(message, false, null, null);
    }

    public static GitWebhookFailure permanent(String message, Throwable cause) {
        return new GitWebhookFailure(message, false, null, cause);
    }
}
