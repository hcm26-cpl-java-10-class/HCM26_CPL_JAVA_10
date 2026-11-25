package com.example.starter_project_2025.system.analytics.student;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

@ResourceMenu(
        title = "Student Analytics",
        group = "Analytics",
        icon = "bar-chart",
        url = "/analytics/students",
        order = 1,
        permission = "STUDENT_ANALYTICS_READ"
)
public class StudentAnalyticsMenuRegistration {
}
