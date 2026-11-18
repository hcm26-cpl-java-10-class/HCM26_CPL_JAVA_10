package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

/**
 * Sinh menu "Khiếu nại điểm" cho học sinh trong nhóm Student.
 */
@ResourceMenu(
        title = "My Appeals",
        group = "Student",
        icon = "message",
        url = "/my-appeals",
        order = 4,
        permission = "SCORE_APPEAL_VIEW_OWN"
)
public class ScoreAppealMenuRegistration {
}
