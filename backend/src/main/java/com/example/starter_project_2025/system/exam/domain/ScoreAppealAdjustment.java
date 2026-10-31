package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;

/**
 * Audit trail of every score change made through a score appeal, so the history of a grade stays visible.
 */
@Entity
@Table(
        name = "score_appeal_adjustment",
        indexes = {
                @Index(name = "idx_score_appeal_adjustment_appeal", columnList = "appeal_id"),
                @Index(name = "idx_score_appeal_adjustment_attempt", columnList = "attempt_id")
        }
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class ScoreAppealAdjustment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "appeal_id", nullable = false)
    private ScoreAppeal appeal;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attempt_id", nullable = false)
    private ExamAttempt attempt;

    @Column(name = "old_score", precision = 12, scale = 4)
    private BigDecimal oldScore;

    @Column(name = "new_score", precision = 12, scale = 4)
    private BigDecimal newScore;

    @Column(nullable = false, length = 2000)
    private String reason;

    @Column(name = "actor_id")
    private Long actorId;

    @Column(name = "actor_name", length = 150)
    private String actorName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    @Builder.Default
    private ScoreAdjustmentAction action = ScoreAdjustmentAction.SCORE_ADJUSTED;
}
