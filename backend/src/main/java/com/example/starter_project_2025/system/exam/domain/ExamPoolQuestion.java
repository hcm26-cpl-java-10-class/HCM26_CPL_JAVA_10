package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.question.domain.EssayGradingCriterion;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        name = "exam_pool_question",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_pool_version_question",
                        columnNames = {"pool_version_id", "question_id"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
public class ExamPoolQuestion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pool_version_id", nullable = false)
    private ExamQuestionPoolVersion poolVersion;

    // ID của Exam-specific Question copy
    @Column(name = "question_id", nullable = false)
    private Long questionId;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    // Question snapshot
    @Column(nullable = false, length = 2000)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private QuestionType type;

    @Column(nullable = false)
    private int points;

    @Column(length = 1000)
    private String imageUrl;

    @Column(name = "code_spec", columnDefinition = "TEXT")
    private String codeSpec;

    // Option snapshots
    @OneToMany(
            mappedBy = "poolQuestion",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @OrderBy("displayOrder ASC")
    private List<ExamPoolQuestionOption> options = new ArrayList<>();

    // Essay grading criteria snapshot
    @ElementCollection
    @CollectionTable(
            name = "exam_pool_question_criterion",
            joinColumns = @JoinColumn(name = "question_id")
    )
    @OrderColumn(name = "display_order")
    private List<EssayGradingCriterion> gradingCriteria =
            new ArrayList<>();
}
