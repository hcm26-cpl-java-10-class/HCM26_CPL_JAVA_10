package com.example.starter_project_2025.system.exam.dto;

import lombok.Getter;
import lombok.Setter;

/**
 * Bai lam cua sinh vien kem thong tin gian lan, dung cho giao vien / admin
 * kiem tra khi xu ly khieng nai diem.
 */
@Getter
@Setter
public class AttemptSubmissionDTO {

    private ExamAttemptReviewDTO review;
    private AttemptIntegritySummary integrity;
}
