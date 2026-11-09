package com.example.starter_project_2025.system.project.workspace.repository;

import com.example.starter_project_2025.system.project.workspace.domain.ProjectLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface ProjectLogRepository extends JpaRepository<ProjectLog, Long>, JpaSpecificationExecutor<ProjectLog> {
    Optional<ProjectLog> findByIdAndWorkspaceIdAndDeletedFalse(Long id, Long workspaceId);
}
