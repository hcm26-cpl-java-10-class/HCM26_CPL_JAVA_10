package com.example.starter_project_2025.system.exam.review.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * Nhật ký thao tác trên workflow tự đánh giá / đánh giá chéo.
 *
 * <p>Bảng riêng {@code exam_review_audit_log}. Ghi actor, thời gian, before/after và correlation ID
 * (theo yêu cầu hậu điều kiện của UFR-EXM-012).
 */
@Entity
@Table(name = "exam_review_audit_log", indexes = {
        @Index(name = "idx_review_audit_exam", columnList = "exam_id"),
        @Index(name = "idx_review_audit_assignment", columnList = "assignment_id")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ExamReviewAuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "exam_id")
    private Long examId;

    @Column(name = "assignment_id")
    private Long assignmentId;

    @Column(name = "attempt_id")
    private Long attemptId;

    @Enumerated(EnumType.STRING)
    @Column(name = "action", length = 40, nullable = false)
    private ExamReviewAuditAction action;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "before_state", columnDefinition = "TEXT")
    private String beforeState;

    @Column(name = "after_state", columnDefinition = "TEXT")
    private String afterState;

    @Column(name = "correlation_id", length = 100)
    private String correlationId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;
}
