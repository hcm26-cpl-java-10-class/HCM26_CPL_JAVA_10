package com.example.starter_project_2025.system.question.version;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface QuestionVersionRepository extends JpaRepository<QuestionVersion, Long> {

    List<QuestionVersion> findAllByQuestionIdOrderByVersionNumberDesc(Long questionId);

    Optional<QuestionVersion> findByQuestionIdAndVersionNumber(Long questionId, int versionNumber);

    boolean existsByQuestionId(Long questionId);

    @Query("select coalesce(max(v.versionNumber), 0) from QuestionVersion v where v.questionId = :questionId")
    int maxVersion(@Param("questionId") Long questionId);

    void deleteAllByQuestionId(Long questionId);
}
