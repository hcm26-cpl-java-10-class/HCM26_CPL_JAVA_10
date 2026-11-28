package com.example.starter_project_2025.system.demo.learningpath;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LearningPathCompletionRepository extends JpaRepository<LearningPathCompletion, Long> {

    Optional<LearningPathCompletion> findByUser_IdAndPath_Id(Long userId, Long pathId);
}
