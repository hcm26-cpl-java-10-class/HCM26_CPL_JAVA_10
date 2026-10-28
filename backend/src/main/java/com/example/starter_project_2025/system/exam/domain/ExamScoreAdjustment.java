package com.example.starter_project_2025.system.exam.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

/** Lich su sua diem thu cong cua 1 luot thi (chi cho luot bi gan co gian lan). */
@Entity
@Table(name = "exam_score_adjustment", indexes = {
        @Index(name = "idx_score_adj_attempt", columnList = "attempt_id")
})
@Getter @Setter @NoArgsConstructor
public class ExamScoreAdjustment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "attempt_id", nullable = false)
    private Long attemptId;

    @Column(name = "exam_id", nullable = false)
    private Long examId;

    @Column(precision = 12, scale = 4)
    private BigDecimal oldScore;

    @Column(nullable = false, precision = 12, scale = 4)
    private BigDecimal newScore;

    @Column(nullable = false, length = 1000)
    private String reason;

    @Column(name = "adjusted_by")
    private Long adjustedBy;

    @Column(nullable = false)
    private Instant adjustedAt;
}
