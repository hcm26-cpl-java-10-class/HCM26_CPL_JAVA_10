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
        List<Bucket> topActors,
        List<EntityActionBucket> byEntityAction
) {

    public record Bucket(String key, long count) {
    }

    /** Number of events of one action on one entity type (feeds the "Actions by Entity" chart). */
    public record EntityActionBucket(String entityType, String action, long count) {
    }

    public record DayBucket(String date, long total, long failures) {
    }
}
