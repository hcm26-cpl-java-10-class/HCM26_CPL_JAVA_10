package com.example.starter_project_2025.system.project.analytics;

import java.util.List;

/**
 * US-ANL-001 AC01: shell payload of the project Analytics view.
 *
 * <p>The shell owns the header metadata, the placeholder filter bar and the
 * 2x2 widget container. Widget data itself is introduced by the follow-up
 * analytics stories, so every widget is reported as {@code PLACEHOLDER} until
 * then. Reading this payload is strictly read-only.</p>
 */
public record ProjectAnalyticsResponse(
        Long projectId,
        String projectCode,
        String projectName,
        String projectStatus,
        boolean readOnly,
        Filters filters,
        List<Widget> widgets
) {

    /** Placeholder description of the filter bar. Filtering is a later story. */
    public record Filters(String state, List<String> planned) { }

    /** One placeholder card in the 2x2 widget grid. */
    public record Widget(String key, String title, String description, String state) { }
}
