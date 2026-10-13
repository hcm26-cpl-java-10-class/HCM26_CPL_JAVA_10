package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.question.domain.Question;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "exam")
@ResourcePermission("EXAM")
@Getter @Setter @NoArgsConstructor
public class Exam extends BaseEntity {

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false)
    private int durationMinutes;

    @ManyToMany
    @JoinTable(name = "exam_question",
            joinColumns = @JoinColumn(name = "exam_id"),
            inverseJoinColumns = @JoinColumn(name = "question_id"))
    private Set<Question> questions = new HashSet<>();
}