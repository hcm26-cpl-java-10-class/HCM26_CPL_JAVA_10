package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.system.exam.domain.ExamQuestionPoolVersion;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExamQuestionPoolVersionRepository
        extends JpaRepository<ExamQuestionPoolVersion, Long> {
    List<ExamQuestionPoolVersion>
    findByExam_IdOrderByVersionNumberDesc(Long examId);

    @EntityGraph(attributePaths = "questions")
    Optional<ExamQuestionPoolVersion>
    findTopByExam_IdOrderByVersionNumberDesc(Long examId);

    @EntityGraph(attributePaths = "questions")
    Optional<ExamQuestionPoolVersion>
    findByExam_IdAndVersionNumber(Long examId, Integer versionNumber);

    boolean existsByExam_Id(Long examId);
}
