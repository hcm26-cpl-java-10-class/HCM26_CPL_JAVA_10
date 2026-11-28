package com.example.starter_project_2025.system.exam.attempt.dto;

import lombok.Getter;
import lombok.Setter;
import com.example.starter_project_2025.system.exam.integrity.dto.AttemptIntegritySummary;

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
