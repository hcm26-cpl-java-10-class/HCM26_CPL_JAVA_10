package com.example.starter_project_2025.system.demo.qna;

import com.example.starter_project_2025.init.annotation.ResourceMenu;

/** Mục menu "Unanswered Questions" cho giảng viên / admin (cần quyền trả lời câu hỏi). */
@ResourceMenu(
        title = "Unanswered Questions",
        group = "Course Management",
        icon = "message",
        url = "/unanswered-questions",
        order = 4,
        permission = "LESSON_ANSWER_CREATE"
)
public class UnansweredQuestionMenuRegistration {
}
