package com.example.starter_project_2025.system.project.developmentinsights.repository;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitValidationRun;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GitValidationRunRepository extends JpaRepository<GitValidationRun, Long> {
    Optional<GitValidationRun> findByRootProject_IdAndOperationKey(Long rootProjectId, String key);
}
