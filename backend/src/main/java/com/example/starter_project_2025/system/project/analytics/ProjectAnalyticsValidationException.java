package com.example.starter_project_2025.system.project.analytics;

/**
 * US-ANL-002 AC04: a rejected Analytics filter.
 *
 * <p>Carries the name of the offending query parameter so
 * {@link ProjectAnalyticsErrors} can answer with HTTP 422 and a field keyed
 * error map. The UI uses that key to highlight the invalid control while it
 * keeps showing the previously loaded, still valid chart data.</p>
 */
public class ProjectAnalyticsValidationException extends RuntimeException {

    private final String field;

    public ProjectAnalyticsValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    /** Query parameter name, e.g. {@code startDate}, {@code endDate}, {@code sprintId}. */
    public String getField() {
        return field;
    }
}
