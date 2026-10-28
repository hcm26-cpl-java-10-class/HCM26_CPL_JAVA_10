package com.example.starter_project_2025.system.project.workspace.repository;

import com.example.starter_project_2025.system.project.workspace.domain.ProjectLogAudit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectLogAuditRepository extends JpaRepository<ProjectLogAudit, Long> {
    List<ProjectLogAudit> findByWorkspaceIdAndLogIdOrderByTimestampDesc(Long workspaceId, Long logId);
}
