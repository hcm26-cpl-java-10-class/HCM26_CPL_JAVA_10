package com.example.starter_project_2025.system.git_integration.contributor;

import java.text.Normalizer;
import java.util.Locale;

/**
 * GI-06: how a Git row is tied to a contributor. A GitHub user id wins ({@code gh:123}); without
 * one (a commit whose e-mail is not linked to GitHub) the normalized e-mail is used
 * ({@code email:dev@x.com}). Bots and rows without either are not contributors.
 */
public final class ContributorIdentity {

    public static final String GITHUB_PREFIX = "gh:";
    public static final String EMAIL_PREFIX = "email:";
    private static final int MAX_EMAIL = 255;

    private ContributorIdentity() {
    }

    /** Null when the row cannot be tied to anyone. */
    public static String key(Long githubId, String email) {
        if (githubId != null) return GITHUB_PREFIX + githubId;
        String normalized = normalizeEmail(email);
        return normalized == null ? null : EMAIL_PREFIX + normalized;
    }

    public static String githubKey(long githubId) {
        return GITHUB_PREFIX + githubId;
    }

    public static String normalizeEmail(String email) {
        if (email == null) return null;
        String trimmed = email.trim().toLowerCase(Locale.ROOT);
        if (trimmed.isEmpty() || !trimmed.contains("@") || trimmed.length() > MAX_EMAIL) return null;
        return trimmed;
    }

    public static boolean isBot(String login) {
        return login != null && login.toLowerCase(Locale.ROOT).endsWith("[bot]");
    }

    /** Lower case, no accents, single spaces: "Nguyễn  Đăng Khánh" and "nguyen dang khanh" match. */
    public static String normalizeName(String name) {
        if (name == null) return "";
        String stripped = Normalizer.normalize(name.replace('đ', 'd').replace('Đ', 'D'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "");
        return stripped.trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
}
