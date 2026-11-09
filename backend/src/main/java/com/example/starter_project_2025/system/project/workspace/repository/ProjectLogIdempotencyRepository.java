package com.example.starter_project_2025.system.project.workspace.repository;

import com.example.starter_project_2025.system.project.workspace.domain.ProjectLogIdempotency;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ProjectLogIdempotencyRepository extends JpaRepository<ProjectLogIdempotency, Long> {
    Optional<ProjectLogIdempotency> findByLogIdAndActorIdAndKey(Long logId, Long actorId, String key);
}
