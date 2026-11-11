package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

@ResourceMenu(
        title = "Course Analytics",
        group = "Analytics",
        icon = "bar-chart",
        url = "/course-analytics",
        order = 2,
        permission = "COURSE_REPORT_READ"
)
public class CourseAnalyticsMenuRegistration {
}
