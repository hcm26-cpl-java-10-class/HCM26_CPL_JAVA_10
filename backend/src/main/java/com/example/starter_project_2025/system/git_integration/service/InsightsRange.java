package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;

import java.time.LocalDate;

/**
 * WS-GH-02: periods of the repository insights. Fixed periods end today and include it;
 * {@link #ALL} starts at the first synchronized commit or pull request; {@link #CUSTOM} takes
 * {@code since}..{@code until} from the request.
 */
public enum InsightsRange {
    D7("7d"), D30("30d"), D90("90d"), M6("6m"), Y1("1y"), ALL("all"), CUSTOM("custom");

    public static final InsightsRange DEFAULT = D30;

    private final String key;

    InsightsRange(String key) {
        this.key = key;
    }

    public String key() {
        return key;
    }

    /** First day of a fixed period ending {@code today}; null for {@link #ALL} and {@link #CUSTOM}. */
    public LocalDate startFor(LocalDate today) {
        return switch (this) {
            case D7 -> today.minusDays(6);
            case D30 -> today.minusDays(29);
            case D90 -> today.minusDays(89);
            case M6 -> today.minusMonths(6).plusDays(1);
            case Y1 -> today.minusYears(1).plusDays(1);
            case ALL, CUSTOM -> null;
        };
    }

    /** Null or blank means the default; an unknown value is a 400. */
    public static InsightsRange parse(String raw) {
        if (raw == null || raw.isBlank()) return DEFAULT;
        for (InsightsRange range : values()) {
            if (range.key.equalsIgnoreCase(raw.trim())) return range;
        }
        throw GitIntegrationException.insightsRangeInvalid();
    }
}
