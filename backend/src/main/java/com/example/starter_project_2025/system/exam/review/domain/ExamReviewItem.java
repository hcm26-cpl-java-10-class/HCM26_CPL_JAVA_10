package com.example.starter_project_2025.system.exam.review.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

/**
 * Diem theo tung tieu chi rubric cua mot cau hoi trong phieu cham.
 *
 * <p>Tieu chi duoc tham chieu bang {@code questionId} + {@code criterionName} (snapshot rubric
 * nam trong {@code ExamAttemptQuestion.gradingCriteria}).
 */
@Entity
@Table(
        name = "exam_review_item",
        indexes = @Index(name = "idx_review_item_submission", columnList = "submission_id")
)
@Getter
@Setter
@NoArgsConstructor
public class ExamReviewItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id", nullable = false)
    private ExamReviewSubmission submission;

    /** Id cau hoi trong bai lam (ExamAttemptQuestion.id). */
    @Column(name = "question_id", nullable = false)
    private Long questionId;

    /** Id cau hoi goc (ExamAttemptQuestion.sourceQuestionId). */
    @Column(name = "source_question_id")
    private Long sourceQuestionId;

    @Column(name = "criterion_name", nullable = false, length = 200)
    private String criterionName;

    @Column(name = "weight_percentage", nullable = false)
    private Integer weightPercentage;

    @Column(name = "max_points", nullable = false, precision = 12, scale = 4)
    private BigDecimal maxPoints;

    @Column(name = "awarded_points", nullable = false, precision = 12, scale = 4)
    private BigDecimal awardedPoints;

    @Column(name = "comment", length = 2000)
    private String comment;
}
