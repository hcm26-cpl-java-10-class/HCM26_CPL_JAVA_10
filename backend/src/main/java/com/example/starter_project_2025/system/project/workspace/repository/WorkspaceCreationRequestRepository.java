package com.example.starter_project_2025.system.project.workspace.repository;

import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceCreationRequest;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface WorkspaceCreationRequestRepository extends JpaRepository<WorkspaceCreationRequest, Long> {
    Optional<WorkspaceCreationRequest> findByTenantIdAndActorIdAndIdempotencyKey(Long tenantId, Long actorId, String key);
}
