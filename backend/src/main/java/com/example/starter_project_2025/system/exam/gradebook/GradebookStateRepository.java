package com.example.starter_project_2025.system.exam.gradebook;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GradebookStateRepository extends JpaRepository<GradebookState, Long> {
    Optional<GradebookState> findByCourse_Id(Long courseId);
}
