package com.example.starter_project_2025.system.exam.domain;

import java.math.BigDecimal; // NEW
import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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

    // NEW: sinh viên đã bấm "Lưu bài" cho câu tự luận này (và chưa sửa lại sau đó)
    @Column(name = "saved", nullable = false)
    private boolean saved = false;

    // CHANGED: Integer -> BigDecimal
    @Column(name = "score", precision = 12, scale = 4)
    private BigDecimal score;

    @Column(name = "feedback", columnDefinition = "TEXT")
    private String feedback;
}