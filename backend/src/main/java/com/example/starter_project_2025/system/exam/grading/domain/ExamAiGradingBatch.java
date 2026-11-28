package com.example.starter_project_2025.system.exam.grading.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        name = "exam_ai_grading_batch",
        indexes = {
                @Index(name = "idx_ai_batch_exam_status", columnList = "exam_id, status"),
                @Index(name = "idx_ai_batch_triggered_by", columnList = "triggered_by_user_id")
        }
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class ExamAiGradingBatch extends BaseEntity {

    /** Null when batch spans all eligible exams managed by the grader; non-null when scoped to one exam. */
    @Column(name = "exam_id")
    private Long examId;

    @Column(name = "exam_title", length = 250)
    private String examTitle;

    @Column(name = "triggered_by_user_id", nullable = false)
    private Long triggeredByUserId;

    @Column(name = "scope", nullable = false, length = 40)
    private String scope;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    private AiGradingBatchStatus status = AiGradingBatchStatus.PENDING;

    @Column(name = "total_attempts", nullable = false)
    private int totalAttempts = 0;

    @Column(name = "pending_count", nullable = false)
    private int pendingCount = 0;

    @Column(name = "processing_count", nullable = false)
    private int processingCount = 0;

    @Column(name = "completed_count", nullable = false)
    private int completedCount = 0;

    @Column(name = "failed_count", nullable = false)
    private int failedCount = 0;

    @Column(name = "skipped_count", nullable = false)
    private int skippedCount = 0;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "notification_sent", nullable = false)
    @Builder.Default
    private boolean notificationSent = false;

    @Column(name = "last_error", length = 1000)
    private String lastError;

    @Column(name = "custom_reference_answer", columnDefinition = "TEXT")
    private String customReferenceAnswer;

    @Column(name = "custom_rubric", columnDefinition = "TEXT")
    private String customRubric;

    @Column(name = "auto_generate_guidelines")
    @Builder.Default
    private Boolean autoGenerateGuidelines = true;

    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ExamAiGradingBatchItem> items = new ArrayList<>();
}
