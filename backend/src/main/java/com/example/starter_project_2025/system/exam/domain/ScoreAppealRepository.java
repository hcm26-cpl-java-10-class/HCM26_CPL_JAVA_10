package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ScoreAppealRepository extends BaseCrudRepository<ScoreAppeal, Long> {

    Optional<ScoreAppeal> findByAttempt_Id(Long attemptId);

    List<ScoreAppeal> findByStudent_IdOrderByCreatedAtDesc(Long studentId);

    List<ScoreAppeal> findByExam_IdOrderByCreatedAtDesc(Long examId);

    List<ScoreAppeal> findByExam_IdAndStatusOrderByCreatedAtAsc(
            Long examId,
            ScoreAppealStatus status
    );

    List<ScoreAppeal> findByStatusOrderByCreatedAtAsc(ScoreAppealStatus status);

    boolean existsByAttempt_Id(Long attemptId);

    boolean existsByAttempt_IdAndStatusIn(
            Long attemptId,
            Collection<ScoreAppealStatus> statuses
    );

    long countByExam_IdAndStatus(Long examId, ScoreAppealStatus status);
}
