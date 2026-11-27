package com.example.starter_project_2025.system.project.aiassistant.repository;

import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewSuggestion;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AIReviewSuggestionRepository
        extends JpaRepository<AIReviewSuggestion, Long> {

    List<AIReviewSuggestion> findByFinding_IdOrderByCreatedAtDesc(Long findingId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM AIReviewSuggestion s WHERE s.id = :id")
    Optional<AIReviewSuggestion> findByIdForUpdate(@Param("id") Long id);
}