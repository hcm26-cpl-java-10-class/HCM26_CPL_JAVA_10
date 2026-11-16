package com.example.starter_project_2025.system.git_integration.github;

import lombok.Getter;

/**
 * Failure while talking to GitHub. The message only names the operation and
 * HTTP status: it never carries codes, tokens or GitHub response bodies.
 */
@Getter
public class GitHubApiException extends RuntimeException {

    public enum Kind {
        /** GitHub rejected the request (bad/expired code, revoked token, missing permission). */
        REJECTED,
        /** Network error, timeout or 5xx from GitHub. */
        UNAVAILABLE,
        /** The installation no longer exists (app uninstalled). */
        GONE,
        /** The installation is suspended by the account owner. */
        SUSPENDED,
        /** GitHub API quota exhausted; see {@link #getRetryAfterSeconds()}. */
        RATE_LIMITED
    }

    private final Kind kind;
    private final int httpStatus;
    private final Long retryAfterSeconds;

    public GitHubApiException(Kind kind, String operation, int httpStatus) {
        this(kind, operation, httpStatus, null);
    }

    public GitHubApiException(Kind kind, String operation, int httpStatus, Long retryAfterSeconds) {
        super("GitHub " + operation + " failed (" + kind + (httpStatus > 0 ? ", HTTP " + httpStatus : "") + ")");
        this.kind = kind;
        this.httpStatus = httpStatus;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    /** Transient failures worth surfacing as "GitHub unavailable" rather than a bad request. */
    public boolean isTransient() {
        return kind == Kind.UNAVAILABLE || kind == Kind.RATE_LIMITED;
    }
}
