package com.example.starter_project_2025.system.project.analytics;

/**
 * US-ANL-001: one project the signed-in user may open Analytics for.
 *
 * <p>Used by the Learning Analytics project selector so mentors and program
 * managers only see projects that are inside their authorized scope.</p>
 */
public record ProjectAnalyticsProjectOption(
        Long projectId,
        String code,
        String name,
        String status
) { }
