package com.example.starter_project_2025.system.exam.integrity.domain;

import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;

/** NEW (anti-cheat) */
public interface ExamIntegrityEventRepository extends JpaRepository<ExamIntegrityEvent, Long> {

    List<ExamIntegrityEvent> findAllByExamIdOrderByOccurredAtAsc(Long examId);

    List<ExamIntegrityEvent> findAllByAttemptIdOrderByOccurredAtAsc(Long attemptId);

    long countByAttemptId(Long attemptId);

    List<ExamIntegrityEvent> findAllByAttemptIdInOrderByOccurredAtDesc(
            Collection<Long> attemptIds
    );

    /** Per exam: how many different attempts have at least one integrity event. Rows are [examId, count]. */
    @Query("select e.examId, count(distinct e.attemptId) from ExamIntegrityEvent e "
            + "where e.examId in :examIds group by e.examId")
    List<Object[]> countFlaggedAttemptsByExam(@Param("examIds") Collection<Long> examIds);
}
