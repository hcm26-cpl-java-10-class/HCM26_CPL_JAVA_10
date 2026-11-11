package com.example.starter_project_2025.system.audit;

import java.util.List;

/**
 * Aggregated numbers shown on the audit statistics dashboard.
 */
public record AuditStatsDTO(
        String fromDate,
        String toDate,
        long total,
        long failures,
        List<DayBucket> byDay,
        List<Bucket> byAction,
        List<Bucket> byEntityType,
        List<Bucket> byResult,
        List<Bucket> topActors
) {

    public record Bucket(String key, long count) {
    }

    public record DayBucket(String date, long total, long failures) {
    }
}
