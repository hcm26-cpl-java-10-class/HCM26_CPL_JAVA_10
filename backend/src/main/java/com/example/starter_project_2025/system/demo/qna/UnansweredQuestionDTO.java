package com.example.starter_project_2025.system.demo.qna;

import java.time.LocalDateTime;

/** Một câu hỏi chưa có câu trả lời, kèm vị trí của nó (khóa học / chương / bài học) để nhảy tới đúng bài. */
public record UnansweredQuestionDTO(
        Long id,
        String content,
        Long authorId,
        String authorName,
        LocalDateTime createdAt,
        Long lessonId,
        String lessonTitle,
        Long sectionId,
        String sectionTitle,
        Long courseId,
        String courseName
) {
}
