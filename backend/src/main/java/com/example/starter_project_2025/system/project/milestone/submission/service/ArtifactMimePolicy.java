package com.example.starter_project_2025.system.project.milestone.submission.service;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

public final class ArtifactMimePolicy {
    public static final Set<String> SUPPORTED_TYPES = Set.of(
            "application/pdf", "application/zip", "image/png", "image/jpeg", "text/plain");

    private ArtifactMimePolicy() { }

    public static Set<String> parse(String value) {
        if (value == null || value.isBlank()) return Set.of();
        return Arrays.stream(value.split(","))
                .map(String::trim).map(type -> type.toLowerCase(Locale.ROOT))
                .filter(type -> !type.isEmpty()).collect(Collectors.toUnmodifiableSet());
    }

    public static boolean isSupported(Set<String> types) {
        return !types.isEmpty() && SUPPORTED_TYPES.containsAll(types);
    }
}
