package com.example.starter_project_2025.system.demo.lessonreport;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

@ResourceMenu(
        title = "Lesson Reports",
        group = "Course Management",
        icon = "flag",
        url = "/lesson-reports",
        order = 5,
        permission = "LESSON_REPORT_READ"
)
public class LessonReportMenuRegistration {
}
