package com.example.starter_project_2025.system.exam.review.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Phan cong cham cho mot bai lam (attempt).
 *
 * <p>Mot bai lam co the co nhieu assignment: 1 ban TU DANH GIA (reviewer = chinh nguoc lam bai) va
 * N ban DANH GIA CHEO (reviewer = nguoi thi khac cung ky thi). Ket qua cham luu rieng, KHONG gan
 * vao {@code ExamAttempt.finalScore}.
 */
@Entity
@Table(
        name = "exam_review_assignment",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_exam_review_assignment",
                columnNames = {"attempt_id", "reviewer_id", "review_type"}
        ),
        indexes = {
                @Index(name = "idx_review_assign_reviewer", columnList = "reviewer_id"),
                @Index(name = "idx_review_assign_attempt", columnList = "attempt_id"),
                @Index(name = "idx_review_assign_exam", columnList = "exam_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
public class ExamReviewAssignment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attempt_id", nullable = false)
    private ExamAttempt attempt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    /** Nguoi thuc hien cham (reviewer). */
    @Column(name = "reviewer_id", nullable = false)
    private Long reviewerId;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_type", nullable = false, length = 20)
    private ExamReviewType reviewType = ExamReviewType.PEER;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private ExamReviewStatus status = ExamReviewStatus.ASSIGNED;

    /** Chup luc phan cong: reviewer co duoc an danh hay khong. */
    @Column(name = "anonymous", nullable = false)
    private Boolean anonymous = true;

    /** Han chiem cham. */
    @Column(name = "due_at")
    private Instant dueAt;

    @Column(name = "assigned_at", nullable = false)
    private Instant assignedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    /** Nguoi thuc hien phan cong (giao vien). */
    @Column(name = "assigned_by")
    private Long assignedBy;
}
