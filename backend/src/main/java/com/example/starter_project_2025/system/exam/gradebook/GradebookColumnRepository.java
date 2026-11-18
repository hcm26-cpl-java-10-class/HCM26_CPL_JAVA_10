package com.example.starter_project_2025.system.exam.gradebook;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GradebookColumnRepository extends JpaRepository<GradebookColumn, Long> {
    List<GradebookColumn> findByCourse_IdOrderByPositionAscIdAsc(Long courseId);

    int countByCourse_Id(Long courseId);
}
