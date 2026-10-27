
package com.example.starter_project_2025.system.exam.domain;

import java.util.ArrayList;
import java.util.List;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.domain.Difficulty;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "exam_template_question")
@Getter
@Setter
@NoArgsConstructor
public class ExamTemplateQuestion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_id", nullable = false)
    private ExamTemplate template;

    @Column(nullable = false, length = 2000)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private QuestionType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Difficulty difficulty;

    private String topic;

    @Column(length = 1000)
    private String imageUrl;

    @Column(nullable = false)
    private int points = 1;

    @Column(nullable = false)
    private int position;

    @OneToMany(
            mappedBy = "templateQuestion",
            cascade = CascadeType.ALL,
            orphanRemoval = true
    )
    @OrderBy("position ASC")
    private List<ExamTemplateQuestionOption> options = new ArrayList<>();
}
