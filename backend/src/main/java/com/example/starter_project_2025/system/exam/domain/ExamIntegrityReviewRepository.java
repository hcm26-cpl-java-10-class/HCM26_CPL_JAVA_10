package com.example.starter_project_2025.system.exam.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** NEW (anti-cheat nang cao) */
public interface ExamIntegrityReviewRepository extends JpaRepository<ExamIntegrityReview, Long> {

    List<ExamIntegrityReview> findAllByExamId(Long examId);

    Optional<ExamIntegrityReview> findByAttemptId(Long attemptId);
}
