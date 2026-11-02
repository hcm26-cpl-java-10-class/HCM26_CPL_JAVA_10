package com.example.starter_project_2025.system.project.resources;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceResourceSnapshotRepository extends JpaRepository<WorkspaceResourceSnapshot, Long> {
    Optional<WorkspaceResourceSnapshot> findByWorkspaceId(Long workspaceId);
}
