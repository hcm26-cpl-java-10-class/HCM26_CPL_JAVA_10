package com.example.starter_project_2025.system.question.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "question_option")
@Getter
@Setter
@NoArgsConstructor
public class QuestionOption extends BaseEntity {

    @Column(nullable = false, length = 1000)
    private String content;

    @Column(name = "is_correct", nullable = false)
    private boolean correct;

    @Column(length = 1000)
    private String imageUrl;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;
}