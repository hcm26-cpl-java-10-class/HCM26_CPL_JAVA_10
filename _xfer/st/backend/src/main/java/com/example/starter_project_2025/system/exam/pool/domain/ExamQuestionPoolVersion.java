package com.example.starter_project_2025.system.exam.pool.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;
import com.example.starter_project_2025.system.exam.core.domain.Exam;

@Entity
@Table(
        name = "exam_question_pool_version",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_exam_pool_version",
                        columnNames = {"exam_id", "version_number"}
                )
        }
)
@Getter
@Setter
@NoArgsConstructor
public class ExamQuestionPoolVersion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @Column(name = "version_number", nullable = false)
    private Integer versionNumber;

    @Column(name = "random_selection_enabled", nullable = false)
    private Boolean randomSelectionEnabled = Boolean.TRUE;

    @Column(name = "random_question_count", nullable = false)
    private Integer randomQuestionCount;

    @Column(name = "shuffle_question_order", nullable = false)
    private Boolean shuffleQuestionOrder = Boolean.TRUE;

    /** Optional JSON list of {difficulty, topic, count}: draw exactly this mix for every student. */
    @Column(name = "quotas_json", columnDefinition = "TEXT")
    private String quotasJson;

    @OneToMany(
            mappedBy = "poolVersion",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @OrderBy("displayOrder ASC")
    private List<ExamPoolQuestion> questions = new ArrayList<>();
}
