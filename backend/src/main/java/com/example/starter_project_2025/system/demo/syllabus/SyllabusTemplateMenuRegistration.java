package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

@ResourceMenu(
        title = "Syllabus Templates",
        group = "Syllabus Management",
        icon = "bookmark",
        url = "/syllabuses/templates",
        order = 2,
        permission = "SYLLABUS_CREATE"
)
public class SyllabusTemplateMenuRegistration {
}
