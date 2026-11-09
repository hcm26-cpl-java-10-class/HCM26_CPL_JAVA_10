package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

@ResourceMenu(
        title = "Course Usage",
        group = "Syllabus Management",
        icon = "link",
        url = "/syllabuses/course-usage",
        order = 1,
        permission = "SYLLABUS_READ"
)
public class SyllabusCourseUsageMenuRegistration {
}
