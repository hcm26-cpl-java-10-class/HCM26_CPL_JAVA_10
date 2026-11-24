package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;

/** WS-GH-02: periods of the repository insights; each includes today. */
public enum InsightsRange {
    D7("7d", 7), D30("30d", 30), D90("90d", 90);

    public static final InsightsRange DEFAULT = D30;

    private final String key;
    private final int days;

    InsightsRange(String key, int days) {
        this.key = key;
        this.days = days;
    }

    public String key() {
        return key;
    }

    public int days() {
        return days;
    }

    /** Null or blank means the default; any other value than 7d / 30d / 90d is a 400. */
    public static InsightsRange parse(String raw) {
        if (raw == null || raw.isBlank()) return DEFAULT;
        for (InsightsRange range : values()) {
            if (range.key.equalsIgnoreCase(raw.trim())) return range;
        }
        throw GitIntegrationException.insightsRangeInvalid();
    }
}
