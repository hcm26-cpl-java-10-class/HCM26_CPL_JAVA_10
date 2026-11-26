package com.example.starter_project_2025.system.exam.integrity.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExamAttemptIntegrityReviewRepository extends JpaRepository<ExamAttemptIntegrityReview, Long> {

    Optional<ExamAttemptIntegrityReview> findByAttemptId(Long attemptId);

    List<ExamAttemptIntegrityReview> findAllByExamId(Long examId);
}
