package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;

public interface ExamRepository extends BaseCrudRepository<Exam, Long> {
    boolean existsByQuestions_Id(Long questionId);
}