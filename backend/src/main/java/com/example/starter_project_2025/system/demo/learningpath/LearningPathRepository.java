package com.example.starter_project_2025.system.demo.learningpath;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LearningPathRepository extends JpaRepository<LearningPath, Long> {

    List<LearningPath> findAllByIsActiveTrueOrderByNameAsc();

    boolean existsByNameIgnoreCaseAndIsActiveTrue(String name);

    boolean existsByNameIgnoreCaseAndIsActiveTrueAndIdNot(String name, Long id);
}
