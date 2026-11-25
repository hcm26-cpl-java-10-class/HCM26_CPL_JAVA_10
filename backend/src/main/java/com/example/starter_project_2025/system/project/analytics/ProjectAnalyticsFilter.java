package com.example.starter_project_2025.system.project.analytics;

import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

/**
 * US-ANL-002: query parameters of the Analytics data collection endpoint.
 *
 * <p>Bound with {@code @ModelAttribute}, so every field is optional and a
 * missing value simply means "no restriction". All semantic validation
 * (unknown scope, unknown work item type, inverted date range, sprint of
 * another project) happens in {@link ProjectAnalyticsService} so it can be
 * reported as HTTP 422 with a field keyed message (AC04).</p>
 *
 * @param scope     {@code ALL} | {@code BACKLOG} | {@code SPRINT}
 * @param sprintId  sprint to analyse; only meaningful for {@code SPRINT}
 * @param startDate first day of the chart window (inclusive)
 * @param endDate   last day of the chart window (inclusive)
 * @param itemType  {@code ALL} | {@code STORY} | {@code BUG} | {@code TASK}
 */
public record ProjectAnalyticsFilter(
        String scope,
        Long sprintId,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
        String itemType
) {

    /** Empty filter: no scope, no sprint, no date window, no work item type. */
    public static ProjectAnalyticsFilter empty() {
        return new ProjectAnalyticsFilter(null, null, null, null, null);
    }
}
