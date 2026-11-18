package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.time.Instant;

/**
 * Stores teacher-submitted reference model answers and grading rubrics
 * scoped per exam and question.
 */
@Entity
@Table(
        name = "exam_question_grading_config",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_exam_question_grading_config",
                columnNames = {"exam_id", "question_id"}
        )
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class ExamQuestionGradingConfig extends BaseEntity {

    @Column(name = "exam_id", nullable = false)
    private Long examId;

    @Column(name = "question_id", nullable = false)
    private Long questionId;

    @Column(name = "reference_answer", columnDefinition = "TEXT")
    private String referenceAnswer;

    @Column(name = "reference_submitted_at")
    private Instant referenceSubmittedAt;

    @Column(name = "rubric", columnDefinition = "TEXT")
    private String rubric;

    @Column(name = "rubric_submitted_at")
    private Instant rubricSubmittedAt;
}
