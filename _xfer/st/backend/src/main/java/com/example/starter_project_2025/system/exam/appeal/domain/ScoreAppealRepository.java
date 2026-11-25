package com.example.starter_project_2025.system.exam.appeal.domain;

import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
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

    /** Per exam: appeals with the given status. Rows are [examId, count]. */
    @Query("select a.exam.id, count(a) from ScoreAppeal a where a.exam.id in :examIds and a.status = :status "
            + "group by a.exam.id")
    List<Object[]> countByExamAndStatus(@Param("examIds") Collection<Long> examIds,
                                        @Param("status") ScoreAppealStatus status);
}
