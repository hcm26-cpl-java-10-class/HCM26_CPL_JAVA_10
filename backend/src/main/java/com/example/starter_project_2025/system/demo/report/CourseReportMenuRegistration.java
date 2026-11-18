package com.example.starter_project_2025.system.demo.report;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

@ResourceMenu(
        title = "Enrollments",
        group = "Course Management",
        icon = "bar-chart",
        url = "/course-enrollments",
        order = 3,
        permission = "COURSE_REPORT_READ"
)
public class CourseReportMenuRegistration {
}