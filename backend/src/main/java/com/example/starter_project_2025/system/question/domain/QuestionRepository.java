package com.example.starter_project_2025.system.question.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;

import java.util.List;

public interface QuestionRepository extends BaseCrudRepository<Question, Long> {

    List<Question> findByExamIdAndSource(Long examId, String source);

    List<Question> findByExamId(Long examId);

    void deleteByExamIdAndSource(Long examId, String source);
}
