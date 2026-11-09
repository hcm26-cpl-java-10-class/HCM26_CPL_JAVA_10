package com.example.starter_project_2025.system.project.activity;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectActivityRepository extends JpaRepository<ProjectActivityLog, Long> {

    List<ProjectActivityLog> findByProjectIdOrderByOccurredAtDesc(Long projectId, Pageable pageable);

    Page<ProjectActivityLog> findByProjectIdAndEntityTypeAndEntityIdAndActionTypeOrderByOccurredAtDesc(
            Long projectId,
            String entityType,
            Long entityId,
            String actionType,
            Pageable pageable
    );

    Optional<ProjectActivityLog> findFirstByProjectIdAndEntityTypeAndEntityIdAndActionTypeAndCorrelationId(
            Long projectId,
            String entityType,
            Long entityId,
            String actionType,
            String correlationId
    );

    boolean existsByCorrelationId(String correlationId);
}
