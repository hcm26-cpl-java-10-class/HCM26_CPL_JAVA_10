package com.example.starter_project_2025.system.demo.qna;

/** Số câu hỏi chưa trả lời của một khóa học (dùng cho bộ lọc khóa học). */
public record CourseUnansweredCount(Long courseId, String courseName, Long count) {
}
