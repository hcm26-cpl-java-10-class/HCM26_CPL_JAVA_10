package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * A student's formal complaint about a published score.
 *
 * <p>One appeal per {@link ExamAttempt}: the student asks for a re-grade, the teacher/admin reviews it
 * and either approves (optionally with a new score) or rejects it.
 */
@Entity
@Table(
        name = "score_appeal",
        indexes = {
                @Index(name = "idx_score_appeal_exam", columnList = "exam_id"),
                @Index(name = "idx_score_appeal_student", columnList = "student_id"),
                @Index(name = "idx_score_appeal_status", columnList = "status")
        }
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class ScoreAppeal extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attempt_id", nullable = false)
    private ExamAttempt attempt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(nullable = false, length = 2000)
    private String reason;

    @Column(name = "requested_score", precision = 12, scale = 4)
    private BigDecimal requestedScore;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private ScoreAppealStatus status = ScoreAppealStatus.PENDING;

    @Column(name = "old_score", precision = 12, scale = 4)
    private BigDecimal oldScore;

    @Column(name = "new_score", precision = 12, scale = 4)
    private BigDecimal newScore;

    @Column(name = "reviewer_id")
    private Long reviewerId;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "resolution_note", length = 2000)
    private String resolutionNote;

    @Column(name = "adjustment_applied", nullable = false)
    @Builder.Default
    private boolean adjustmentApplied = false;
}
