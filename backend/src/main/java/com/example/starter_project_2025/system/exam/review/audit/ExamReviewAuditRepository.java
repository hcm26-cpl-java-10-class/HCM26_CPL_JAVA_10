package com.example.starter_project_2025.system.exam.review.audit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExamReviewAuditRepository extends JpaRepository<ExamReviewAuditLog, Long> {

    List<ExamReviewAuditLog> findAllByExamIdOrderByCreatedAtAsc(Long examId);

    List<ExamReviewAuditLog> findAllByAssignmentIdOrderByCreatedAtAsc(Long assignmentId);
}
