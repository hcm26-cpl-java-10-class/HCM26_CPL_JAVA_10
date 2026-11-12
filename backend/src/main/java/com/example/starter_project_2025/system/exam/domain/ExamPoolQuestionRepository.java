package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.system.exam.domain.ExamPoolQuestion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExamPoolQuestionRepository
        extends JpaRepository<ExamPoolQuestion, Long> {

    List<ExamPoolQuestion>
    findByPoolVersion_IdOrderByDisplayOrderAsc(Long poolVersionId);

    boolean existsByPoolVersion_IdAndQuestionId(
            Long poolVersionId,
            Long questionId
    );

    boolean existsByQuestionId(Long questionId);

    List<ExamPoolQuestion> findByQuestionId(Long questionId);

    void deleteByPoolVersion_Id(Long poolVersionId);
}
