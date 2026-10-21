package com.example.starter_project_2025.system.question.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
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
@ResourceMenu(
        title = "Questions",
        group = "Exam Management",
        icon = "help-circle",
        url = "/questions",
        order = 2,
        permission = "QUESTION_READ"
)
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

    @Column(length = 1000)
    private String imageUrl;

    @Column(nullable = false)
    private int points = 1;

    // Khác null nghĩa là đây là bản sao thuộc riêng một đề thi; giá trị là id câu hỏi gốc trong ngân hàng
    @Column(name = "source_question_id")
    private Long sourceQuestionId;

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