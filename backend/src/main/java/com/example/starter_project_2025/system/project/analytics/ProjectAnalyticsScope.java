package com.example.starter_project_2025.system.project.analytics;

/**
 * US-ANL-002: the three ways the Analytics scope filter can narrow the work
 * item population of a project.
 *
 * <ul>
 *     <li>{@link #ALL} — every work item of the project, sprint assigned or not
 *     ("All Project Work Items").</li>
 *     <li>{@link #BACKLOG} — only the product backlog, i.e. items with
 *     {@code sprint_id IS NULL} (AC02).</li>
 *     <li>{@link #SPRINT} — the items of exactly one sprint (AC01).</li>
 * </ul>
 */
public enum ProjectAnalyticsScope {

    ALL,
    BACKLOG,
    SPRINT;

    /**
     * Parses the {@code scope} query parameter.
     *
     * <p>An empty value falls back to {@link #SPRINT} when a {@code sprintId}
     * was supplied (the two parameters only make sense together) and to
     * {@link #ALL} otherwise, so the endpoint stays usable without filters.</p>
     *
     * @throws ProjectAnalyticsValidationException with the {@code scope} field
     *         when the value is not one of the three supported names.
     */
    public static ProjectAnalyticsScope parse(String raw, Long sprintId) {
        if (raw == null || raw.isBlank()) {
            return sprintId == null ? ALL : SPRINT;
        }
        for (ProjectAnalyticsScope value : values()) {
            if (value.name().equalsIgnoreCase(raw.trim())) {
                return value;
            }
        }
        throw new ProjectAnalyticsValidationException(
                "scope", "Scope must be one of ALL, BACKLOG or SPRINT");
    }
}
