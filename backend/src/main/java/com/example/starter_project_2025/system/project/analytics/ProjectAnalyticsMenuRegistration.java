package com.example.starter_project_2025.system.project.analytics;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

/**
 * US-ANL-001: mentor/PM entry point. The page hosts the project selector that
 * opens {@code /projects/{projectId}/analytics}.
 */
@ResourceMenu(
        title = "Project Analytics",
        group = "Analytics",
        icon = "bar-chart",
        url = "/analytics/projects",
        order = 3,
        permission = "PROJECT_ANALYTICS_READ"
)
public class ProjectAnalyticsMenuRegistration {
}
