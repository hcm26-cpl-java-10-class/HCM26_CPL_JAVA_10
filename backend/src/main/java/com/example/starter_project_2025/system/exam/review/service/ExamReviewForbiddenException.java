package com.example.starter_project_2025.system.exam.review.service;

/**
 * Khong du quyen (403): reviewer khong phai chu assignment, hoac ket qua chua duoc cong bo.
 */
public class ExamReviewForbiddenException extends RuntimeException {

    public ExamReviewForbiddenException(String message) {
        super(message);
    }
}
