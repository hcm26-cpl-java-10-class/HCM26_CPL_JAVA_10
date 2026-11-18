package com.example.starter_project_2025.system.exam.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExamGradeScaleRepository extends JpaRepository<ExamGradeScale, Long> {
    List<ExamGradeScale> findAllByExam_IdAndScaleTypeOrderByDisplayOrderAsc(Long examId, String scaleType);
    List<ExamGradeScale> findAllByExam_IdOrderByDisplayOrderAsc(Long examId);
    void deleteAllByExam_IdAndScaleType(Long examId, String scaleType);
    void deleteAllByExam_Id(Long examId);
}
