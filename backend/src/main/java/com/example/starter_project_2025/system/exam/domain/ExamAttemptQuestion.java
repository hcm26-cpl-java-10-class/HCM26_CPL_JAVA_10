package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.domain.EssayGradingCriterion;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "exam_attempt_question")
@Getter
@Setter
@NoArgsConstructor
public class ExamAttemptQuestion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attempt_id", nullable = false)
    private ExamAttempt attempt;

    @Column(nullable = false)
    private Long sourceQuestionId;

    @Column(nullable = false, length = 2000)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private QuestionType type;

    @Column(nullable = false)
    private int points;

    @Column(length = 1000)
    private String imageUrl;

    @Column(nullable = false)
    private int displayOrder;

    /** Ban chup JSON bai lap trinh (ham + test case) tai thoi diem bat dau bai thi. */
    @Column(name = "code_spec", columnDefinition = "TEXT")
    private String codeSpec;

    /**
     * Ban chup Reference answer / Rubric (ExamQuestionGradingConfig) tai thoi diem bai lam duoc cham lan dau.
     * Sua rubric sau do chi ap dung cho bai chua cham. null guidelineSnapshotAt = chua chup.
     */
    @Column(name = "guideline_reference", columnDefinition = "TEXT")
    private String guidelineReference;

    @Column(name = "guideline_rubric", columnDefinition = "TEXT")
    private String guidelineRubric;

    @Column(name = "guideline_reference_at")
    private java.time.Instant guidelineReferenceAt;

    @Column(name = "guideline_rubric_at")
    private java.time.Instant guidelineRubricAt;

    @Column(name = "guideline_snapshot_at")
    private java.time.Instant guidelineSnapshotAt;

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    private List<ExamAttemptOption> options = new ArrayList<>();

    @ElementCollection
    @CollectionTable(name = "exam_attempt_question_criterion", joinColumns = @JoinColumn(name = "question_id"))
    @OrderColumn(name = "display_order")
    private List<EssayGradingCriterion> gradingCriteria = new ArrayList<>();
}