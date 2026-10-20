package com.example.starter_project_2025.system.exam.domain;

import java.util.HashSet;
import java.util.Set;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.question.domain.Question;
import jakarta.persistence.*;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "exam")
@ResourcePermission("EXAM")
@ResourceMenu(
    title = "Exams",
    group = "Exam Management",
    icon = "book-open",
    url = "/exams",
    order = 1,
    permission = "EXAM_READ"
)
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