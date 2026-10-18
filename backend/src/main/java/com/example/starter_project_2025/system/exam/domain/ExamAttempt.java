package com.example.starter_project_2025.system.exam.domain;

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
                name = "uk_exam_attempt_exam_student",
                columnNames = {"exam_id", "student_id"}
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

    @Column(nullable = false)
    private int durationMinutes;

    @Column(nullable = false)
    private int totalPoints;

    @Column(nullable = false)
    private Instant startedAt;

    private Instant submittedAt;

    private Integer objectiveScore;

    private Integer finalScore;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ExamAttemptStatus status = ExamAttemptStatus.IN_PROGRESS;

    @OneToMany(mappedBy = "attempt", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<ExamAttemptAnswer> answers = new HashSet<>();

    @OneToMany(mappedBy = "attempt", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    private List<ExamAttemptQuestion> questions = new ArrayList<>();
}