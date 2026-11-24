package com.example.starter_project_2025.system.git_integration.contributor;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * GI-06: the identities seen in a batch of Git rows, merged per identity key. The login and
 * name of the latest row win, so a renamed GitHub account shows its new login (AC08).
 */
public final class ContributorSightings {

    /** One identity of the batch. {@code email} is only kept for an e-mail-only contributor. */
    public record Sighting(String key, Long githubId, String email, String login, String name,
                           LocalDateTime firstAt, LocalDateTime lastAt) {
    }

    private final Map<String, Sighting> byKey = new LinkedHashMap<>();

    /** Adds a row; bots and rows without an identity are skipped. */
    public ContributorSightings add(Long githubId, String email, String login, String name,
                                    LocalDateTime firstAt, LocalDateTime lastAt) {
        if (ContributorIdentity.isBot(login)) return this;
        String key = ContributorIdentity.key(githubId, email);
        if (key == null) return this;
        String cleanLogin = blankToNull(login);
        String cleanName = blankToNull(name);
        String keptEmail = githubId == null ? ContributorIdentity.normalizeEmail(email) : null;
        byKey.merge(key, new Sighting(key, githubId, keptEmail, cleanLogin, cleanName, firstAt, lastAt), ContributorSightings::merge);
        return this;
    }

    public ContributorSightings add(Long githubId, String email, String login, String name, LocalDateTime at) {
        return add(githubId, email, login, name, at, at);
    }

    /**
     * Like {@link #add(Long, String, String, String, LocalDateTime, LocalDateTime)}, but a row without
     * GitHub id whose login is a known GitHub contributor's counts as that contributor.
     */
    public ContributorSightings add(ContributorDirectory directory, Long githubId, String email, String login, String name,
                                    LocalDateTime firstAt, LocalDateTime lastAt) {
        Long id = githubId;
        if (id == null) {
            var viaLogin = directory.gitHubByLogin(login);
            if (viaLogin != null) id = viaLogin.getExternalUserId();
        }
        return add(id, email, login, name, firstAt, lastAt);
    }

    /** The identity key a row counts for in {@code directory} (same rule as {@link ContributorDirectory#resolve}). */
    public static String keyOf(ContributorDirectory directory, Long githubId, String login, String email) {
        if (githubId == null) {
            var viaLogin = directory.gitHubByLogin(login);
            if (viaLogin != null) return viaLogin.getIdentityKey();
        }
        return ContributorIdentity.key(githubId, email);
    }

    public Collection<Sighting> all() {
        return byKey.values();
    }

    public boolean isEmpty() {
        return byKey.isEmpty();
    }

    private static Sighting merge(Sighting a, Sighting b) {
        boolean bIsNewer = isAfterOrSame(b.lastAt(), a.lastAt());
        Sighting newer = bIsNewer ? b : a;
        Sighting older = bIsNewer ? a : b;
        return new Sighting(a.key(), a.githubId(), a.email(),
                newer.login() != null ? newer.login() : older.login(),
                newer.name() != null ? newer.name() : older.name(),
                earliest(a.firstAt(), b.firstAt()), latest(a.lastAt(), b.lastAt()));
    }

    static boolean isAfterOrSame(LocalDateTime candidate, LocalDateTime current) {
        if (candidate == null) return current == null;
        return current == null || !candidate.isBefore(current);
    }

    static LocalDateTime earliest(LocalDateTime a, LocalDateTime b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isBefore(b) ? a : b;
    }

    static LocalDateTime latest(LocalDateTime a, LocalDateTime b) {
        if (a == null) return b;
        if (b == null) return a;
        return a.isAfter(b) ? a : b;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
