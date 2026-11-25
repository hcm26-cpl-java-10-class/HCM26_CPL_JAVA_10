package com.example.starter_project_2025.system.topic_mark;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

@ResourceMenu(
        title = "Topic Mark Gradebook",
        group = "Score Management",
        icon = "clipboard-check",
        url = "/topic-marks/gradebook-demo",
        order = 2,
        permission = "STUDENT_SCORE_READ"
)
public class TopicMarkMenuRegistration {
}
