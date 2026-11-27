package com.example.starter_project_2025.system.exam.grading.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(
        name = "exam_ai_grading_batch_item",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_ai_batch_item_batch_attempt",
                columnNames = {"batch_id", "attempt_id"}
        ),
        indexes = {
                @Index(name = "idx_ai_batch_item_status", columnList = "batch_id, status"),
                @Index(name = "idx_ai_batch_item_attempt", columnList = "attempt_id")
        }
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class ExamAiGradingBatchItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "batch_id", nullable = false)
    private ExamAiGradingBatch batch;

    @Column(name = "exam_id", nullable = false)
    private Long examId;

    @Column(name = "attempt_id", nullable = false)
    private Long attemptId;

    @Column(name = "student_id")
    private Long studentId;

    @Column(name = "student_name", length = 200)
    private String studentName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private AiEssayGradingState status = AiEssayGradingState.PENDING;

    @Column(name = "retry_count", nullable = false)
    @Builder.Default
    private int retryCount = 0;

    @Column(name = "essay_count", nullable = false)
    @Builder.Default
    private int essayCount = 0;

    @Column(name = "ai_graded_essay_count", nullable = false)
    @Builder.Default
    private int aiGradedEssayCount = 0;

    @Column(name = "proposed_total_essay_score", precision = 12, scale = 4)
    private BigDecimal proposedTotalEssayScore;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;
}
