package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "exam_pool_question_option")
@Getter
@Setter
@NoArgsConstructor
public class ExamPoolQuestionOption extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pool_question_id", nullable = false)
    private ExamPoolQuestion poolQuestion;

    @Column(nullable = false)
    private Long sourceOptionId;

    @Column(nullable = false, length = 1000)
    private String content;

    @Column(name = "is_correct", nullable = false)
    private boolean correct;

    @Column(length = 1000)
    private String imageUrl;

    @Column(nullable = false)
    private int displayOrder;
}
