package com.example.starter_project_2025.system.project.workspace.repository;

import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceActivity;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface WorkspaceActivityRepository extends JpaRepository<WorkspaceActivity, Long> {
    boolean existsByEventId(String eventId);
    List<WorkspaceActivity> findByWorkspaceIdOrderByOccurredAtDesc(Long workspaceId);
}
