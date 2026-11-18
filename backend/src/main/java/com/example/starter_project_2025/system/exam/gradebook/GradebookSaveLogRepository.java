package com.example.starter_project_2025.system.exam.gradebook;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GradebookSaveLogRepository extends JpaRepository<GradebookSaveLog, Long> {
    List<GradebookSaveLog> findByCourse_IdOrderBySavedAtDesc(Long courseId);
}
