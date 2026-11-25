package com.example.starter_project_2025.system.exam.review.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * Phieu cham da nop cho mot {@link ExamReviewAssignment}.
 *
 * <p>Diem tong (`overallScore`) chi mang y nghia tham khhao, KHONG duoc ghi vao
 * {@code ExamAttempt.finalScore} va khong anh huong diem Course.
 */
@Entity
@Table(name = "exam_review_submission")
@Getter
@Setter
@NoArgsConstructor
public class ExamReviewSubmission extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assignment_id", nullable = false, unique = true)
    private ExamReviewAssignment assignment;

    /** Diem tong cham theo rubric (nullable). */
    @Column(name = "overall_score", precision = 12, scale = 4)
    private BigDecimal overallScore;

    /** Tong diem toi da cua rubric (snapshot luc cham). */
    @Column(name = "max_overall_score", precision = 12, scale = 4)
    private BigDecimal maxOverallScore;

    @Column(name = "overall_comment", columnDefinition = "TEXT")
    private String overallComment;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;
}
