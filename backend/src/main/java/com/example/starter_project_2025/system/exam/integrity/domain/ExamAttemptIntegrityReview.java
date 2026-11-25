package com.example.starter_project_2025.system.exam.integrity.domain;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;

@Entity
@Table(
        name = "exam_attempt_integrity_review",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_integrity_review_attempt",
                columnNames = {"attempt_id"}
        ),
        indexes = @Index(name = "idx_integrity_review_exam", columnList = "exam_id")
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ExamAttemptIntegrityReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    Long id;

    @Column(name = "exam_id", nullable = false)
    Long examId;

    @Column(name = "attempt_id", nullable = false)
    Long attemptId;

    @Enumerated(EnumType.STRING)
    @Column(name = "review_status", nullable = false, length = 30)
    @Builder.Default
    IntegrityReviewStatus reviewStatus = IntegrityReviewStatus.UNREVIEWED;

    @Column(name = "review_note", length = 1000)
    String reviewNote;

    @Column(name = "reviewed_by")
    Long reviewedBy;

    @Column(name = "reviewed_at")
    Instant reviewedAt;
}
