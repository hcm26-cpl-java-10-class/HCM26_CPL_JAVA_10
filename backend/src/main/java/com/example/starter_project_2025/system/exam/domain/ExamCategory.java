package com.example.starter_project_2025.system.exam.domain;

// Loại thi theo mục đích (khác với ExamType là dạng câu hỏi). Mỗi loại có luật mặc định cho việc show đáp án.
public enum ExamCategory {
    ASSESSMENT(true),
    PROGRESS_TEST(true),
    FINAL_TEST(false);

    private final boolean showAnswersByDefault;

    ExamCategory(boolean showAnswersByDefault) {
        this.showAnswersByDefault = showAnswersByDefault;
    }

    public boolean isShowAnswersByDefault() {
        return showAnswersByDefault;
    }
}
