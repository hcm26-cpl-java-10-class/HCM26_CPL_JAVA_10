package com.example.starter_project_2025.system.project.workspace.repository;

import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceAudit;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WorkspaceAuditRepository extends JpaRepository<WorkspaceAudit, Long> {
    List<WorkspaceAudit> findByWorkspaceId(Long workspaceId);
}
