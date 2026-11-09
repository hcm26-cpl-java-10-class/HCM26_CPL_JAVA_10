
package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "exam_template_question_option")
@Getter
@Setter
@NoArgsConstructor
public class ExamTemplateQuestionOption extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "template_question_id", nullable = false)
    private ExamTemplateQuestion templateQuestion;

    @Column(nullable = false, length = 1000)
    private String content;

    @Column(name = "is_correct", nullable = false)
    private boolean correct;

    @Column(length = 1000)
    private String imageUrl;

    @Column(nullable = false)
    private int position;
}
