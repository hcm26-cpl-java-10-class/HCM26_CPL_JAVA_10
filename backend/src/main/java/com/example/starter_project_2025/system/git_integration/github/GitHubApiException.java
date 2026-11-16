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
        UNAVAILABLE
    }

    private final Kind kind;
    private final int httpStatus;

    public GitHubApiException(Kind kind, String operation, int httpStatus) {
        super("GitHub " + operation + " failed (" + kind + (httpStatus > 0 ? ", HTTP " + httpStatus : "") + ")");
        this.kind = kind;
        this.httpStatus = httpStatus;
    }
}
