package com.example.starter_project_2025.system.exam.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/** NEW (anti-cheat nang cao): 1 dong = ket qua xem xet cua giao vien cho 1 luot thi. */
@Entity
@Table(name = "exam_integrity_review", uniqueConstraints =
        @UniqueConstraint(name = "uk_integrity_review_attempt", columnNames = "attempt_id"))
@Getter @Setter @NoArgsConstructor
public class ExamIntegrityReview {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "attempt_id", nullable = false)
    private Long attemptId;

    @Column(name = "exam_id", nullable = false)
    private Long examId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private IntegrityReviewStatus status;

    @Column(length = 1000)
    private String note;

    private Long reviewerId;

    @Column(length = 200)
    private String reviewerName;

    @Column(nullable = false)
    private Instant reviewedAt;
}
