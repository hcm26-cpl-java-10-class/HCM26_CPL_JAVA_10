package com.example.starter_project_2025.system.exam.domain;

import java.math.BigDecimal;
import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(
        name = "exam_attempt",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_exam_attempt_exam_student_number",
                columnNames = {"exam_id", "student_id", "attempt_number"}
        )
)
@Getter
@Setter
@NoArgsConstructor
public class ExamAttempt extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(name = "attempt_number", nullable = false)
    private int attemptNumber = 1;

    @Column(nullable = false)
    private int durationMinutes;

    @Column(nullable = false)
    private int totalPoints;

    @Column(nullable = false)
    private Instant startedAt;

    private Instant officialDeadlineAt;

    private Instant deadlineAt;

    @Column(nullable = false)
    private boolean lateGraceEligible;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private LatePolicy latePolicy;

    private Integer latePenaltyPercent;

    private Instant submittedAt;

    private Integer latePenaltyPercentApplied;

    @Column(precision = 8, scale = 2)
    private BigDecimal maxScore;

    @Column(precision = 12, scale = 4)
    private BigDecimal objectiveScore;

    @Column(precision = 12, scale = 4)
    private BigDecimal finalScore;

    /** Diem cham lan 1 (giu nguyen khi giao vien sua diem). Null neu chua co cham lan 2. */
    @Column(precision = 12, scale = 4)
    private BigDecimal firstScore;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ExamAttemptStatus status = ExamAttemptStatus.IN_PROGRESS;

    // NEW (anti-cheat): tab/thiet bi gan nhat dang lam bai (phat hien mo nhieu noi)
    @Column(length = 64)
    private String lastClientId;

    private Instant lastClientSeenAt;

    @OneToMany(mappedBy = "attempt", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<ExamAttemptAnswer> answers = new HashSet<>();

    @OneToMany(mappedBy = "attempt", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    private List<ExamAttemptQuestion> questions = new ArrayList<>();
}