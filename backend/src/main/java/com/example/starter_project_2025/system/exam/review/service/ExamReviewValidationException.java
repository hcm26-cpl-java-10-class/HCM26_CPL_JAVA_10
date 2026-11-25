package com.example.starter_project_2025.system.exam.review.service;

/**
 * Du lieu nghiep vu khong hop le (422): diem vuot rubric, thieu tieu chi, reviewer khong du dieu kien.
 */
public class ExamReviewValidationException extends RuntimeException {

    private final String field;

    public ExamReviewValidationException(String field, String message) {
        super(message);
        this.field = field;
    }

    public String getField() {
        return field;
    }
}
