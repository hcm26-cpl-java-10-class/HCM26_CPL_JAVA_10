package com.example.starter_project_2025.system.exam.review.service;

/**
 * Trang thai xung dot (409): thao tac lap lai khong hop le (da nop phieu cham, da gan reviewer...).
 */
public class ExamReviewConflictException extends RuntimeException {

    public ExamReviewConflictException(String message) {
        super(message);
    }
}
