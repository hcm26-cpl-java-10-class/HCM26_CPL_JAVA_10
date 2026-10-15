package com.example.starter_project_2025.system.question.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "question")
@ResourcePermission("QUESTION")
@Getter
@Setter
@NoArgsConstructor
public class Question extends BaseEntity {

    @Column(nullable = false, length = 2000)
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private QuestionType type;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Difficulty difficulty;

    private String topic;

    @Column(nullable = false)
    private int points = 1;

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<QuestionOption> options = new ArrayList<>();

    @PrePersist
    @PreUpdate
    private void normalizeTopic() {
        if (topic != null) {
            topic = topic.trim().toLowerCase();
            if (topic.isEmpty()) topic = null;
        }
    }
}