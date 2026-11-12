package com.example.starter_project_2025.system.project.aiassistant.repository;

import com.example.starter_project_2025.system.project.aiassistant.enums.SuggestionStatus;
import com.example.starter_project_2025.system.project.aiassistant.repository.AiSuggestionRepository;
import com.example.starter_project_2025.system.project.aiassistant.entity.AiSuggestion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiSuggestionRepository
        extends JpaRepository<AiSuggestion, Long> {

    List<AiSuggestion> findByStatus(SuggestionStatus status);

}