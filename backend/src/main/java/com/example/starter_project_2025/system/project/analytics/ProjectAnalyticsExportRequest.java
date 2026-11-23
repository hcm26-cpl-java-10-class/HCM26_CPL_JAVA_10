package com.example.starter_project_2025.system.project.analytics;

import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;

/**
 * US-ANL-010: request payload for {@code POST /api/v1/projects/{projectId}/analytics/export}.
 *
 * @param format    {@code CSV}, {@code XLSX} or {@code PDF}
 * @param scope     {@code ALL} | {@code BACKLOG} | {@code SPRINT}
 * @param sprintId  selected sprint when {@code scope=SPRINT}
 * @param startDate first date of the filter window (inclusive)
 * @param endDate   last date of the filter window (inclusive)
 * @param itemType  {@code ALL} | {@code STORY} | {@code BUG} | {@code TASK}
 */
public record ProjectAnalyticsExportRequest(
        String format,
        String scope,
        Long sprintId,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
        String itemType
) {

    public ProjectAnalyticsFilter toFilter() {
        return new ProjectAnalyticsFilter(scope, sprintId, startDate, endDate, itemType);
    }
}
