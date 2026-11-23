package com.example.starter_project_2025.system.exam.review.domain;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ExamReviewAssignmentRepository
        extends org.springframework.data.jpa.repository.JpaRepository<ExamReviewAssignment, Long> {

    List<ExamReviewAssignment> findAllByReviewerIdOrderByAssignedAtDesc(Long reviewerId);

    List<ExamReviewAssignment> findAllByReviewerIdAndStatusOrderByAssignedAtDesc(
            Long reviewerId,
            ExamReviewStatus status
    );

    List<ExamReviewAssignment> findAllByExam_Id(Long examId);

    List<ExamReviewAssignment> findAllByAttempt_Id(Long attemptId);

    Optional<ExamReviewAssignment> findByIdAndReviewerId(Long id, Long reviewerId);

    Optional<ExamReviewAssignment> findByAttempt_IdAndReviewerIdAndReviewType(
            Long attemptId,
            Long reviewerId,
            ExamReviewType reviewType
    );

    boolean existsByAttempt_IdAndReviewerIdAndReviewType(
            Long attemptId,
            Long reviewerId,
            ExamReviewType reviewType
    );

    long countByExam_IdAndStatus(Long examId, ExamReviewStatus status);

    @Query("select a.reviewerId from ExamReviewAssignment a "
            + "where a.attempt.id = :attemptId and a.reviewType = :reviewType")
    List<Long> findReviewerIdsByAttemptAndType(
            @Param("attemptId") Long attemptId,
            @Param("reviewType") ExamReviewType reviewType
    );
}
