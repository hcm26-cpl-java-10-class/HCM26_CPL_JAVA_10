package com.example.starter_project_2025.system.project.aiassistant.repository;

import com.example.starter_project_2025.system.project.aiassistant.enums.SuggestionStatus;
import com.example.starter_project_2025.system.project.aiassistant.repository.AiSuggestionRepository;
import com.example.starter_project_2025.system.project.aiassistant.entity.AiSuggestion;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface AiSuggestionRepository
        extends JpaRepository<AiSuggestion, Long> {

    List<AiSuggestion> findByStatus(SuggestionStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM AiSuggestion s WHERE s.id = :id")
    Optional<AiSuggestion> findByIdForUpdate(@Param("id") Long id);
}