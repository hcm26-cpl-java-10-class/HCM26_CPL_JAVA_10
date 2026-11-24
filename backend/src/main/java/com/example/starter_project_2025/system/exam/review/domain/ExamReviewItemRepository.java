package com.example.starter_project_2025.system.exam.review.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExamReviewItemRepository extends JpaRepository<ExamReviewItem, Long> {

    List<ExamReviewItem> findAllBySubmission_Id(Long submissionId);

    List<ExamReviewItem> findAllBySubmission_Assignment_Id(Long assignmentId);
}
