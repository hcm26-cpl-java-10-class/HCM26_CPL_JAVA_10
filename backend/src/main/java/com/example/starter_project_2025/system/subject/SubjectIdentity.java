package com.example.starter_project_2025.system.subject;

import java.util.List;
import java.util.Locale;

/** Shared identity rules for CRUD, imports and persistence. */
final class SubjectIdentity {
    private SubjectIdentity() {}

    static String normalizeCode(String code) {
        return code == null ? null : code.trim().toUpperCase(Locale.ROOT);
    }

    static String normalizeVersion(String version) {
        return version == null ? null
                : version.trim().toLowerCase(Locale.ROOT).replaceFirst("^v(?=\\d)", "");
    }

    static List<String> versionAliases(String version) {
        String normalized = normalizeVersion(version);
        if (normalized == null || normalized.isBlank()) return List.of();
        // Include legacy values such as v1.0 without rewriting existing records.
        return normalized.matches("^[0-9].*")
                ? List.of(normalized, "v" + normalized) : List.of(normalized);
    }
}
