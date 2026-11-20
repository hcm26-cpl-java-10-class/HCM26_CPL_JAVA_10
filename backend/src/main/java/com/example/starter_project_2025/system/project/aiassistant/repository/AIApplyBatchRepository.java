package com.example.starter_project_2025.system.project.aiassistant.repository;

import com.example.starter_project_2025.system.project.aiassistant.entity.AIApplyBatch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AIApplyBatchRepository
        extends JpaRepository<AIApplyBatch, Long> {

    Optional<AIApplyBatch> findBySuggestion_Id(Long suggestionId);

    boolean existsBySuggestion_Id(Long suggestionId);
}
