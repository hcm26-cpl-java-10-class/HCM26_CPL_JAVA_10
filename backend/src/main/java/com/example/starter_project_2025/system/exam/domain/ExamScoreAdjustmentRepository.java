package com.example.starter_project_2025.system.exam.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExamScoreAdjustmentRepository extends JpaRepository<ExamScoreAdjustment, Long> {

    List<ExamScoreAdjustment> findAllByExamId(Long examId);
}
