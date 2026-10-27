
package com.example.starter_project_2025.system.exam.domain;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "exam_template")
@Getter
@Setter
@NoArgsConstructor
public class ExamTemplate extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false)
    private int durationMinutes;

    @Column(nullable = false)
    private Integer maxAttempts = 1;

    @Column(nullable = false)
    private Boolean shuffleQuestions = false;

    @Column(nullable = false)
    private Boolean shuffleOptions = false;

    @Column(nullable = false)
    private Boolean showAnswersAfterExam = false;

    @Column(precision = 8, scale = 2)
    private BigDecimal passScore;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal maxScore = BigDecimal.TEN;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private LatePolicy latePolicy = LatePolicy.NOT_ALLOWED;

    private Integer latePenaltyPercent;

    @Column(nullable = false)
    private Integer lateGraceMinutes = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ResultVisibility resultVisibility = ResultVisibility.IMMEDIATE;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ExamType examType = ExamType.MIXED;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ExamCategory category = ExamCategory.ASSESSMENT;

    @OneToMany(
            mappedBy = "template",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @OrderBy("position ASC")
    private List<ExamTemplateQuestion> questions = new ArrayList<>();
}
