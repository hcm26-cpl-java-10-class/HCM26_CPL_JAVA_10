package com.example.starter_project_2025.system.git_integration.domain;

import java.util.Locale;
import java.util.Optional;

/** SY-04: state of a pull request review (GitHub sends lower case, e.g. {@code changes_requested}). */
public enum GitReviewState {
    APPROVED,
    CHANGES_REQUESTED,
    COMMENTED,
    DISMISSED,
    PENDING;

    public static Optional<GitReviewState> fromGitHub(String value) {
        if (value == null || value.isBlank()) return Optional.empty();
        try {
            return Optional.of(valueOf(value.trim().toUpperCase(Locale.ROOT)));
        } catch (IllegalArgumentException unknown) {
            return Optional.empty();
        }
    }
}
