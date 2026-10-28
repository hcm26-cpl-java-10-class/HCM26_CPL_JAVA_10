package com.example.starter_project_2025.system.project;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;

/**
 * US-11 — the four team roles a member can hold.
 *
 * <p>Historically {@code project_members.member_role} stored a single role
 * code. To support templates with {@code allow_multi_role = true} the column
 * now stores a canonical comma separated list (for example {@code "PM,BA"}).
 * The helpers on this enum are the single place that knows how to read and
 * write that representation, so a legacy single value keeps working.</p>
 */
public enum ProjectMemberRole {
    PM,
    BA,
    DEV,
    QA;

    private static final String SEPARATOR = ",";

    public static boolean isValid(String role) {
        return role != null
                && Arrays.stream(values()).anyMatch(value -> value.name().equals(role));
    }

    /** All roles stored in a {@code member_role} value, in canonical order. */
    public static List<String> parseRoles(String storedRoles) {
        if (storedRoles == null || storedRoles.isBlank()) {
            return List.of();
        }
        return normalizeRoles(Arrays.asList(storedRoles.split(SEPARATOR)));
    }

    /**
     * Trims, upper-cases, de-duplicates and filters to known roles, preserving
     * the enum declaration order. Unknown tokens are dropped.
     */
    public static List<String> normalizeRoles(Collection<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return List.of();
        }
        EnumSet<ProjectMemberRole> selected = EnumSet.noneOf(ProjectMemberRole.class);
        for (String role : roles) {
            if (role == null || role.isBlank()) {
                continue;
            }
            String normalized = role.trim().toUpperCase();
            if (isValid(normalized)) {
                selected.add(ProjectMemberRole.valueOf(normalized));
            }
        }
        return selected.stream().map(ProjectMemberRole::name).toList();
    }

    /** Canonical storage representation; an empty list becomes {@code null}. */
    public static String formatRoles(Collection<String> roles) {
        List<String> normalized = normalizeRoles(roles);
        return normalized.isEmpty() ? null : String.join(SEPARATOR, normalized);
    }

    /**
     * True when every comma separated token is a known role and the value is
     * not empty. Unlike {@link #parseRoles(String)} this rejects unknown codes
     * instead of silently dropping them.
     */
    public static boolean isValidSpec(String storedRoles) {
        if (storedRoles == null || storedRoles.isBlank()) {
            return false;
        }
        return Arrays.stream(storedRoles.split(SEPARATOR))
                .map(String::trim)
                .filter(token -> !token.isEmpty())
                .allMatch(ProjectMemberRole::isValid);
    }

    public static boolean hasRole(String storedRoles, String role) {
        return role != null && parseRoles(storedRoles).contains(role);
    }

    public static int countRole(String storedRoles, String role) {
        return hasRole(storedRoles, role) ? 1 : 0;
    }

    /** Package-private helper used when validating raw request payloads. */
    static List<String> rawRoles(Collection<String> roles) {
        if (roles == null) {
            return List.of();
        }
        List<String> copy = new ArrayList<>();
        for (String role : roles) {
            if (role != null && !role.isBlank()) {
                copy.add(role.trim().toUpperCase());
            }
        }
        return copy;
    }

    static boolean containsUnknownRole(Collection<String> roles) {
        return roles == null || roles.stream()
                .filter(role -> role != null)
                .map(String::trim)
                .map(String::toUpperCase)
                .anyMatch(role -> !isValid(role));
    }
}
