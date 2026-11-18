package com.example.starter_project_2025.system.exam.domain;

import java.math.BigDecimal;
import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(
        name = "exam_attempt_answer",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_exam_attempt_answer_question",
                columnNames = {"attempt_id", "question_id"}
        )
)
@Getter
@Setter
@NoArgsConstructor
public class ExamAttemptAnswer extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attempt_id", nullable = false)
    private ExamAttempt attempt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private ExamAttemptQuestion question;

    @ManyToMany
    @JoinTable(
            name = "exam_attempt_answer_option",
            joinColumns = @JoinColumn(name = "answer_id"),
            inverseJoinColumns = @JoinColumn(name = "option_id")
    )
    private Set<ExamAttemptOption> selectedOptions = new HashSet<>();

    @Column(columnDefinition = "TEXT")
    private String textAnswer;

    @Column(name = "saved", nullable = false)
    private boolean saved = false;

    @Column(name = "score", precision = 12, scale = 4)
    private BigDecimal score;

    @Column(name = "feedback", columnDefinition = "TEXT")
    private String feedback;

    /** Trang thai tung test cua cau coding luc cham, dang JSON ["OK","WRONG_ANSWER",...]. */
    @Column(name = "code_result", columnDefinition = "TEXT")
    private String codeResult;

    /** So lan may cham da loi khi cham nen (toi da CodingGradingService.MAX_AUTO_ATTEMPTS). */
    @Column(name = "grade_attempts", nullable = false)
    private int gradeAttempts = 0;

    /** Thoi diem som nhat duoc thu cham lai tu dong. */
    private Instant nextGradeAt;
}