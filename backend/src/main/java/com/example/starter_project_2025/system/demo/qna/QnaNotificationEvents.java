package com.example.starter_project_2025.system.demo.qna;

/**
 * Các sự kiện Q&A cần gửi thông báo. Chỉ chứa dữ liệu thô (không có entity) để listener chạy
 * bất đồng bộ sau khi transaction commit mà không bị lỗi lazy-loading.
 */
public final class QnaNotificationEvents {

    private QnaNotificationEvents() {
    }

    /** Học viên vừa đặt câu hỏi mới -> báo cho giảng viên của khóa học. */
    public record QuestionPosted(
            String recipientEmail,
            String recipientName,
            String askerName,
            String courseName,
            String lessonTitle,
            String questionContent,
            Long courseId,
            Long sectionId,
            Long lessonId,
            Long questionId
    ) {
    }

    /** Giảng viên vừa trả lời -> báo cho người đặt câu hỏi. {@code enrollmentId} có thể null. */
    public record QuestionAnswered(
            String recipientEmail,
            String recipientName,
            String answererName,
            String courseName,
            String lessonTitle,
            String questionContent,
            String answerContent,
            Long enrollmentId,
            Long lessonId,
            Long questionId
    ) {
    }
}
