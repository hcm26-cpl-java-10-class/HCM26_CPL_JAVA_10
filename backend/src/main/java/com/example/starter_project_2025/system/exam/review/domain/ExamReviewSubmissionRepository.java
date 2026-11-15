package com.example.starter_project_2025.system.exam.review.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExamReviewSubmissionRepository
        extends JpaRepository<ExamReviewSubmission, Long> {

    Optional<ExamReviewSubmission> findByAssignment_Id(Long assignmentId);

    List<ExamReviewSubmission> findAllByAssignment_Attempt_Id(Long attemptId);

    List<ExamReviewSubmission> findAllByAssignment_Attempt_IdAndAssignment_Status(
            Long attemptId,
            ExamReviewStatus status
    );
}
